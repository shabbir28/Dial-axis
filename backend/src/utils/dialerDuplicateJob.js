const { Worker } = require('node:worker_threads');
const path = require('node:path');
const fs = require('node:fs');

function createDuplicateJob(getReport, dialer = require('./dialerSources').sources.t6) {
    const { cachePath, directory } = dialer;
    let state = { status: 'idle', result: null };
    let nextStart = 0;
    try {
        const result = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if ((result.dialer_id === dialer.id || (!result.dialer_id && dialer.id === 't6')) &&
            ['total_records', 'unique_numbers', 'duplicate_entries', 'missing_numbers', 'total_lists'].every(key => Number.isSafeInteger(result[key]) && result[key] >= 0) &&
            result.unique_numbers + result.duplicate_entries + result.missing_numbers === result.total_records && Number.isFinite(Date.parse(result.scanned_at))) {
            state = { status: 'complete', result };
            nextStart = result.export_id && result.export_version === 3 ? Date.parse(result.scanned_at) + 5 * 60_000 : 0;
        }
    } catch { /* No saved aggregate yet. */ }
    if (state.result?.export_version === 2) {
        const saved = state.result;
        state = { ...state, status: 'running', completed: 0, total_lists: saved.total_lists, scanned_records: saved.total_records };
        require('./dialerOccurrences').addOccurrences(saved, directory)
            .then(async result => {
                state = { ...state, status: 'complete', result };
                await fs.promises.writeFile(cachePath + '.tmp', JSON.stringify(result));
                await fs.promises.rename(cachePath + '.tmp', cachePath);
            }).catch(fail);
    }
    function fail() {
        state = { ...state, status: 'failed', error: 'Scan failed: check export permission and connection, or retry if lists changed during the scan.' };
    }
    return {
        status: () => ({ ...state, retry_at: new Date(nextStart).toISOString() }),
        start() {
            if (state.status === 'running' || Date.now() < nextStart) return this.status();
            nextStart = Date.now() + 5 * 60_000;
            state = { status: 'running', result: state.result, completed: 0, total_lists: null, scanned_records: 0 };
            Promise.resolve().then(async () => {
                const report = await getReport({ refresh: true });
                if (report.stale) throw new Error('Fresh campaign list required.');
                state.total_lists = report.lists.length;
                const worker = new Worker(path.join(__dirname, 'dialerDuplicatesWorker.js'), {
                    workerData: { dialerId: dialer.id, lists: report.lists.map(({ list_id, total_leads }) => ({ list_id, total_leads })) },
                });
                worker.on('message', message => {
                    if (message.type === 'progress') state = { ...state, ...message.value };
                    if (message.type === 'complete') {
                        const previousId = state.result?.export_id;
                        state = { ...state, status: 'complete', result: message.value };
                        nextStart = Date.now() + 5 * 60_000;
                        fs.promises.mkdir(path.dirname(cachePath), { recursive: true })
                            .then(() => fs.promises.writeFile(cachePath + '.tmp', JSON.stringify(message.value)))
                            .then(() => fs.promises.rename(cachePath + '.tmp', cachePath))
                            .then(async () => {
                                if (previousId && previousId !== message.value.export_id && /^[a-f0-9-]{36}$/.test(previousId)) {
                                    await Promise.all(['unique', 'duplicates'].map(kind => fs.promises.unlink(path.join(directory, `${previousId}-${kind}.csv`)).catch(() => {})));
                                }
                            })
                            .catch(() => { /* In-memory counts remain available if persistence is unavailable. */ });
                    }
                    if (message.type === 'failed') fail();
                });
                worker.on('error', fail);
                worker.on('exit', () => { if (state.status === 'running') fail(); });
            }).catch(fail);
            return this.status();
        },
    };
}

module.exports = { createDuplicateJob };
