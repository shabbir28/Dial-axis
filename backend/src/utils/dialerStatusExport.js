const fs = require('node:fs');
const path = require('node:path');
const csv = require('csv-parser');
const { pipeline } = require('node:stream/promises');

async function exportStatuses(result, kind, statuses, directory) {
    if (!['unique', 'duplicates'].includes(kind) || result.export_version !== 3 || !/^[a-f0-9-]{36}$/.test(result.export_id || '') ||
        !Array.isArray(statuses) || !statuses.length || statuses.length > 100 || statuses.some(s => typeof s !== 'string' || !s.length || s.length > 100)) throw new Error('Invalid status selection.');
    const selected = new Set(statuses);
    const parts = ['phone_number,call_count,status,lead_call_attempts,list_id,lead_id\n'];
    let total = 0;
    let count = 0;
    await pipeline(fs.createReadStream(path.join(directory, `${result.export_id}-${kind}.csv`)), csv({ strict: true }), async rows => {
        for await (const row of rows) {
            if (typeof row.status !== 'string' || ['phone_number', 'occurrence_count', 'call_count', 'list_id', 'lead_id'].some(key => !/^\d+$/.test(row[key] || ''))) throw new Error('Invalid record.');
            total++;
            if (!selected.has(row.status.trim() || 'UNKNOWN')) continue;
            parts.push(`${row.phone_number},${row.occurrence_count},"${row.status.replace(/"/g, '""')}",${row.call_count},${row.list_id},${row.lead_id}\n`);
            count++;
        }
    });
    if (total !== result[kind === 'unique' ? 'unique_numbers' : 'duplicate_entries']) throw new Error('Incomplete export.');
    return { csv: parts.join(''), count, fileName: `dialer-${kind}-selected-statuses.csv` };
}

module.exports = { exportStatuses };
