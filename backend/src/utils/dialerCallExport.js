const { matchesExport } = require('./dialerMetrics');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const csvParser = require('csv-parser');

async function callCountExport(result, kind, directory) {
    if (!['under5', 'over5', 'dnc'].includes(kind) || result.export_version !== 3 || !/^[a-f0-9-]{36}$/.test(result.export_id || '')) throw new Error('Invalid export.');
    const parts = ['phone_number,occurrence_count,status,call_count,list_id,lead_id\n'];
    for (const sourceKind of ['unique', 'duplicates']) {
        let rows = 0;
        await pipeline(fs.createReadStream(path.join(directory, `${result.export_id}-${sourceKind}.csv`)), csvParser({ strict: true }), async source => {
            for await (const row of source) {
                if (!/^[1-9]\d*$/.test(row.occurrence_count || '') || !/^\d+$/.test(row.call_count || '') || !/^\d+$/.test(row.phone_number || '') || !/^\d+$/.test(row.list_id || '') || !/^\d+$/.test(row.lead_id || '') || typeof row.status !== 'string') throw new Error('Invalid export row.');
                rows++;
                if (matchesExport(kind, row.occurrence_count, row.status)) {
                    parts.push(`${row.phone_number},${row.occurrence_count},"${row.status.replace(/"/g, '""')}",${row.call_count},${row.list_id},${row.lead_id}\n`);
                }
            }
        });
        if (rows !== result[sourceKind === 'unique' ? 'unique_numbers' : 'duplicate_entries']) throw new Error('Incomplete export.');
    }
    return parts.join('');
}

module.exports = { callCountExport };
