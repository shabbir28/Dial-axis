const fs = require('node:fs');
const path = require('node:path');
const csv = require('csv-parser');
const { pipeline } = require('node:stream/promises');

async function summarizeStatuses(result, kind, directory) {
    if (!['unique', 'duplicates'].includes(kind) || result.export_version !== 3 || !/^[a-f0-9-]{36}$/.test(result.export_id || '')) throw new Error('Detailed scan required.');
    const counts = new Map();
    let total = 0;
    await pipeline(fs.createReadStream(path.join(directory, `${result.export_id}-${kind}.csv`)), csv({ strict: true }), async rows => {
        for await (const row of rows) {
            if (typeof row.status !== 'string') throw new Error('Missing status column.');
            const status = row.status.trim() || 'UNKNOWN';
            counts.set(status, (counts.get(status) || 0) + 1);
            total++;
        }
    });
    if (total !== result[kind === 'unique' ? 'unique_numbers' : 'duplicate_entries']) throw new Error('Incomplete export.');
    return { kind, total, scanned_at: result.scanned_at, export_id: result.export_id,
        statuses: [...counts].map(([status, count]) => ({ status, count, percentage: total ? count / total * 100 : 0 }))
            .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)) };
}

function createStatusSummary() {
    const cache = new Map();
    return (result, kind, directory) => {
        const key = `${result.export_id}:${kind}`;
        if (!cache.has(key)) {
            if (cache.size >= 4) cache.delete(cache.keys().next().value);
            const pending = summarizeStatuses(result, kind, directory).catch(error => { cache.delete(key); throw error; });
            cache.set(key, pending);
        }
        return cache.get(key);
    };
}

module.exports = { summarizeStatuses, createStatusSummary };
