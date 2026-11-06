const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const csv = require('csv-parser');
const { emptyMetrics, addMetrics } = require('./dialerMetrics');

async function addOccurrences(result, directory) {
    if (result.export_version === 3) return result;
    if (result.export_version !== 2 || !/^[a-f0-9-]{36}$/.test(result.export_id || '')) throw new Error('Detailed export required.');
    const frequencies = new Map();
    const kinds = ['unique', 'duplicates'];
    const sourcePath = kind => path.join(directory, `${result.export_id}-${kind}.csv`);
    for (const kind of kinds) {
        let count = 0;
        await pipeline(fs.createReadStream(sourcePath(kind)), csv({ strict: true }), async rows => {
            for await (const row of rows) {
                if (!/^\d+$/.test(row.phone_number || '') || !/^\d+$/.test(row.call_count || '') || !/^\d+$/.test(row.lead_id || '') || !/^\d+$/.test(row.list_id || '') || typeof row.status !== 'string') throw new Error('Invalid saved record.');
                frequencies.set(row.phone_number, (frequencies.get(row.phone_number) || 0) + 1);
                count++;
            }
        });
        if (count !== result[kind === 'unique' ? 'unique_numbers' : 'duplicate_entries']) throw new Error('Incomplete export.');
    }
    if (frequencies.size !== result.unique_numbers) throw new Error('Incorrect distinct total.');
    const id = randomUUID();
    const counts = emptyMetrics();
    const files = kinds.map(kind => path.join(directory, `${id}-${kind}.csv`));
    try {
        for (const [index, kind] of kinds.entries()) {
            await pipeline(fs.createReadStream(sourcePath(kind)), csv({ strict: true }), async function* (rows) {
                yield 'phone_number,occurrence_count,status,call_count,list_id,lead_id\n';
                for await (const row of rows) {
                    const occurrences = frequencies.get(row.phone_number);
                    addMetrics(counts, occurrences, row.status);
                    yield `${row.phone_number},${occurrences},"${row.status.replace(/"/g, '""')}",${row.call_count},${row.list_id},${row.lead_id}\n`;
                }
            }, fs.createWriteStream(files[index], { flags: 'wx' }));
        }
    } catch (error) {
        await Promise.all(files.map(file => fs.promises.unlink(file).catch(() => {})));
        throw error;
    }
    return { ...result, export_id: id, export_version: 3, occurrence_counts: counts };
}

module.exports = { addOccurrences };
