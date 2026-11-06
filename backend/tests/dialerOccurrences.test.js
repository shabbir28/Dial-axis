const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { addOccurrences } = require('../src/utils/dialerOccurrences');
const { callCountExport } = require('../src/utils/dialerCallExport');

test('occurrences span both exports and stay separate from actual call attempts', async () => {
    const dir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'occurrences-'));
    const result = { export_version: 2, export_id: '00000000-0000-0000-0000-000000000000', unique_numbers: 2, duplicate_entries: 1 };
    const header = 'phone_number,status,call_count,list_id,lead_id\n';
    try {
        await fs.writeFile(path.join(dir, `${result.export_id}-unique.csv`), header + '5551234567,"A",5,3001,1\n5557654321,"DNC",1,3001,2\n');
        await fs.writeFile(path.join(dir, `${result.export_id}-duplicates.csv`), header + '5551234567,"HUBP",7,3004,3\n');
        const upgraded = await addOccurrences(result, dir);
        const unique = await fs.readFile(path.join(dir, `${upgraded.export_id}-unique.csv`), 'utf8');
        assert.ok(unique.includes('5551234567,2,"A",5,3001,1'));
        assert.ok(unique.includes('5557654321,1,"DNC",1,3001,2'));
        assert.equal(upgraded.occurrence_counts.zero_to_four, 2);
        assert.equal(upgraded.occurrence_counts.dnc, 1);
        assert.equal(upgraded.occurrence_counts.five_or_more, 0);
        const output = await callCountExport(upgraded, 'under5', dir);
        assert.ok(output.includes('5551234567,2,"HUBP",7,3004,3'));
        assert.equal((await callCountExport(upgraded, 'over5', dir)).trim().split('\n').length, 1);
    } finally {
        for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file));
        await fs.rmdir(dir);
    }
});
