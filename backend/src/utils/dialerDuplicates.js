const { emptyMetrics, addMetrics } = require('./dialerMetrics');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const csv = require('csv-parser');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Count primary phone_number values across all lists; optionally prepare private CSV exports.
async function scanDuplicates({ lists, fetchImpl = fetch, user, password, progress = () => {}, outputDir, dialerId = 't6' }) {
    if (!user || !password) throw new Error('Dialer credentials are missing.');
    const phones = new Map();
    let total = 0;
    let missing = 0;
    const callCounts = emptyMetrics();
    for (let index = 0; index < lists.length; index++) {
        const list = lists[index];
        if (!/^\d{1,12}$/.test(list.list_id)) throw new Error('Invalid list.');
        const url = new URL('list_download.php', require('./dialerSources').sources[dialerId].baseUrl);
        url.searchParams.set('list_id', list.list_id);
        const response = await fetchImpl(url, {
            method: 'GET', redirect: 'error', signal: AbortSignal.timeout(180_000),
            headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64') },
        });
        if (!response.ok || !response.body) throw new Error('List export unavailable.');
        let rows = 0;
        let validHeaders = false;
        let headerCount;
        let callCountIndex;
        // VICIdial exports can contain extra tabs in trailing free-text columns.
        // Validate the identifying columns and final row count instead of dropping those leads.
        const parser = csv({ separator: '\t', quote: '\0', maxRowBytes: 1024 * 1024 });
        parser.on('headers', headers => {
            headerCount = headers.length;
            callCountIndex = headers.indexOf('called_count');
            validHeaders = ['phone_number', 'list_id', 'lead_id', ...(outputDir ? ['status', 'called_count'] : [])].every(key => headers.includes(key));
            if (!validHeaders) parser.destroy(new Error('List export permission or format is invalid.'));
        });
        await pipeline(Readable.fromWeb(response.body), parser, async source => {
            for await (const row of source) {
                if (row.list_id !== list.list_id || !/^\d+$/.test(row.lead_id) || typeof row.phone_number !== 'string') throw new Error('Invalid export row.');
                const phone = row.phone_number.trim().replace(/[\s()+.-]/g, '');
                if (!/^\d+$/.test(phone)) missing++;
                else {
                    const previous = phones.get(phone) || { count: 0, records: outputDir ? [] : null };
                    previous.count++;
                    const values = Object.values(row);
                    const calls = callCountIndex < 0 ? undefined : values[values.length - (headerCount - callCountIndex)];
                    addMetrics(callCounts, calls, row.status);
                    if (outputDir) {
                        // Extra tabs in VICIdial comments precede called_count. Align the trailing columns.
                        if (!/^\d+$/.test(calls || '') || typeof row.status !== 'string') throw new Error('Invalid status or call count in export.');
                        const status = row.status.replace(/^[=+@-]/, "'$&").replace(/"/g, '""');
                        previous.records.push(`${phone},"${status}",${calls},${row.list_id},${row.lead_id}\n`);
                    }
                    phones.set(phone, previous);
                }
                rows++;
                total++;
            }
        });
        if (!validHeaders || rows !== list.total_leads) throw new Error('List size changed or export is incomplete. Please scan again.');
        progress({ completed: index + 1, total_lists: lists.length, scanned_records: total });
    }
    let export_id;
    if (outputDir) {
        await fs.promises.mkdir(outputDir, { recursive: true });
        export_id = randomUUID();
        const files = ['unique', 'duplicates'].map(kind => path.join(outputDir, `${export_id}-${kind}.csv`));
        try {
            for (let index = 0; index < files.length; index++) {
                function* lines() {
                    yield 'phone_number,status,call_count,list_id,lead_id\n';
                    for (const entry of phones.values()) {
                        const start = index === 0 ? 0 : 1;
                        const end = index === 0 ? 1 : entry.records.length;
                        for (let copy = start; copy < end; copy++) yield entry.records[copy];
                    }
                }
                await pipeline(Readable.from(lines()), fs.createWriteStream(files[index], { flags: 'wx' }));
            }
        } catch (error) {
            await Promise.all(files.map(file => fs.promises.unlink(file).catch(() => {})));
            throw error;
        }
    }
    return { dialer_id: dialerId, campaign_id: require('./dialerSources').sources[dialerId].campaignId,
        ...(export_id ? { export_id, export_version: 2 } : {}), total_records: total, unique_numbers: phones.size, duplicate_entries: total - missing - phones.size,
        call_counts: callCounts, missing_numbers: missing, total_lists: lists.length, scanned_at: new Date().toISOString() };
}

async function readExportCallCounts(result, directory) {
    if (result.export_version !== 2 || !/^[a-f0-9-]{36}$/.test(result.export_id || '')) throw new Error('Detailed exports required.');
    const counts = emptyMetrics();
    for (const kind of ['unique', 'duplicates']) {
        let rows = 0;
        await pipeline(fs.createReadStream(path.join(directory, `${result.export_id}-${kind}.csv`)), csv({ strict: true }), async source => {
            for await (const row of source) {
                if (!/^\d+$/.test(row.call_count || '')) throw new Error('Invalid call count.');
                addMetrics(counts, row.call_count, row.status);
                rows++;
            }
        });
        if (rows !== (kind === 'unique' ? result.unique_numbers : result.duplicate_entries)) throw new Error('Incomplete export.');
    }
    return counts;
}

module.exports = { scanDuplicates, readExportCallCounts };
