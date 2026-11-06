const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { exportStatuses } = require('../src/utils/dialerStatusExport');

test('single and multi-status exports preserve records without repeated selection duplication', async () => {
    const dir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'status-export-'));
    const result = { export_version: 3, export_id: '00000000-0000-0000-0000-000000000000', unique_numbers: 3, duplicate_entries: 1 };
    const header = 'phone_number,occurrence_count,status,call_count,list_id,lead_id\n';
    try {
        await fs.writeFile(path.join(dir, `${result.export_id}-unique.csv`), header + '5551234567,2,A,5,3001,1\n5551234568,1,AA,0,3001,2\n5551234569,1,NI,2,3001,3\n');
        await fs.writeFile(path.join(dir, `${result.export_id}-duplicates.csv`), header + '5551234567,2,AA,7,3004,4\n');
        const single = await exportStatuses(result, 'unique', ['A'], dir);
        assert.equal(single.count, 1);
        assert.equal(single.csv, 'phone_number,call_count,status,lead_call_attempts,list_id,lead_id\n5551234567,2,"A",5,3001,1\n');
        const combined = await exportStatuses(result, 'unique', ['A', 'NI', 'A'], dir);
        assert.equal(combined.count, 2);
        assert.ok(!combined.csv.includes('"AA"'));
        const dup = await exportStatuses(result, 'duplicates', ['AA'], dir);
        assert.equal(dup.count, 1);
        assert.ok(dup.csv.includes('3004,4'));
        await assert.rejects(exportStatuses(result, 'unique', [], dir));
        await assert.rejects(exportStatuses({ ...result, unique_numbers: 4 }, 'unique', ['A'], dir));
        await assert.rejects(exportStatuses(result, '../file', ['A'], dir));
    } finally {
        for (const name of await fs.readdir(dir)) await fs.unlink(path.join(dir, name));
        await fs.rmdir(dir);
    }
});
