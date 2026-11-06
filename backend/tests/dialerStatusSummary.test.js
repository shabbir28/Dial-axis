const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { summarizeStatuses, createStatusSummary } = require('../src/utils/dialerStatusSummary');

test('status summaries keep unique and duplicate populations separate and validate totals', async () => {
    const dir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'status-summary-'));
    const result = { export_version: 3, export_id: '00000000-0000-0000-0000-000000000000', unique_numbers: 3, duplicate_entries: 2 };
    try {
        await fs.writeFile(path.join(dir, `${result.export_id}-unique.csv`), 'status\nA\nA\nAA\n');
        await fs.writeFile(path.join(dir, `${result.export_id}-duplicates.csv`), 'status\nNI\nDNC\n');
        const get = createStatusSummary();
        const first = get(result, 'unique', dir);
        assert.equal(first, get(result, 'unique', dir));
        const unique = await first;
        assert.equal(unique.total, 3);
        assert.deepEqual(unique.statuses.map(row => [row.status, row.count]), [['A', 2], ['AA', 1]]);
        const duplicates = await get(result, 'duplicates', dir);
        assert.deepEqual(duplicates.statuses.map(row => [row.status, row.count]), [['DNC', 1], ['NI', 1]]);
        await assert.rejects(summarizeStatuses({ ...result, unique_numbers: 4 }, 'unique', dir));
        await assert.rejects(summarizeStatuses(result, '../file', dir));
    } finally {
        for (const name of await fs.readdir(dir)) await fs.unlink(path.join(dir, name));
        await fs.rmdir(dir);
    }
});
