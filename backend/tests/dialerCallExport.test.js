const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { callCountExport } = require('../src/utils/dialerCallExport');

test('call exports combine both files, retain statuses, and filter occurrence counts while keeping DNC separate', async () => {
    const directory = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'call-export-'));
    const result = { export_version: 3, export_id: '00000000-0000-0000-0000-000000000000', unique_numbers: 2, duplicate_entries: 3 };
    const header = 'phone_number,occurrence_count,status,call_count,list_id,lead_id\n';
    try {
        await fs.writeFile(path.join(directory, `${result.export_id}-unique.csv`), header + '5551234567,1,"NEW",0,1,1\n5557654321,4,"SALE",4,1,2\n');
        await fs.writeFile(path.join(directory, `${result.export_id}-duplicates.csv`), header + '5551234567,3,"DNC",3,2,3\n5551234567,5,"NA",5,2,4\n5551234567,6,"NA",6,2,5\n');
        assert.equal(await callCountExport(result, 'under5', directory), header + '5551234567,1,"NEW",0,1,1\n5557654321,4,"SALE",4,1,2\n');
        assert.equal(await callCountExport(result, 'over5', directory), header + '5551234567,5,"NA",5,2,4\n5551234567,6,"NA",6,2,5\n');
        assert.equal(await callCountExport(result, 'dnc', directory), header + '5551234567,3,"DNC",3,2,3\n');
        await assert.rejects(callCountExport(result, '../unique', directory));
        await assert.rejects(callCountExport({ ...result, duplicate_entries: 4 }, 'under5', directory));
    } finally {
        for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
        await fs.rmdir(directory);
    }
});
