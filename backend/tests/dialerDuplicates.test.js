const test = require('node:test');
const assert = require('node:assert/strict');
const { scanDuplicates, readExportCallCounts } = require('../src/utils/dialerDuplicates');

test('CSV files preserve repeat counts without filtering dialer statuses', async () => {
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const dir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'dialer-export-test-'));
    try {
        const result = await scanDuplicates({ user: 'test', password: 'private', outputDir: dir,
            lists: [{ list_id: '1', total_leads: 3 }, { list_id: '2', total_leads: 1 }], fetchImpl: async url => new Response(url.searchParams.get('list_id') === '1' ?
                'lead_id\tlist_id\tphone_number\tstatus\tcomments\tcalled_count\n1\t1\t5551234567\tNEW\t\t0\n2\t1\t5551234567\tSALE\tcomment\textra tab\t7\n3\t1\t5557654321\tDNC\t\t12\n' :
                'lead_id\tlist_id\tphone_number\tstatus\tcomments\tcalled_count\n4\t2\t5551234567\tNA\t\t3\n') });
        const unique = await fs.readFile(path.join(dir, `${result.export_id}-unique.csv`), 'utf8');
        const duplicates = await fs.readFile(path.join(dir, `${result.export_id}-duplicates.csv`), 'utf8');
        assert.equal(unique, 'phone_number,status,call_count,list_id,lead_id\n5551234567,"NEW",0,1,1\n5557654321,"DNC",12,1,3\n');
        assert.equal(duplicates, 'phone_number,status,call_count,list_id,lead_id\n5551234567,"SALE",7,1,2\n5551234567,"NA",3,2,4\n');
        assert.equal(result.unique_numbers, 2);
        assert.equal(result.duplicate_entries, 2);
        assert.equal(result.export_version, 2);
        assert.deepEqual(result.call_counts, { version: 3, zero_to_four: 2, five_or_more: 1, unknown: 0, dnc: 1 });
        assert.deepEqual(await readExportCallCounts(result, dir), result.call_counts);
    } finally {
        for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file));
        await fs.rmdir(dir);
    }
});

const header = 'lead_id\tlist_id\tphone_number\n';
const config = { user: 'test', password: 'private' };
test('FE scan uses only the FE host and identifies its campaign independently', async () => {
    const result = await scanDuplicates({ ...config, dialerId: 'fe', lists: [{ list_id: '364', total_leads: 1 }],
        fetchImpl: async url => {
            assert.equal(url.origin, 'https://balitechfe.dialerhosting.com');
            assert.equal(url.pathname, '/BcVBcXr/list_download.php');
            assert.equal(url.searchParams.get('list_id'), '364');
            return new Response('lead_id\tlist_id\tphone_number\n1\t364\t5551234567\n');
        } });
    assert.equal(result.dialer_id, 'fe');
    assert.equal(result.campaign_id, '1002');
    assert.equal(result.unique_numbers, 1);
});
test('call-count ranges include zero and exactly five', async () => {
    const result = await scanDuplicates({ ...config, lists: [{ list_id: '1', total_leads: 4 }],
        fetchImpl: async () => new Response('lead_id\tlist_id\tphone_number\tcalled_count\n1\t1\t5551234567\t0\n2\t1\t5551234567\t3\n3\t1\t5551234567\t4\n4\t1\t5551234567\t5\n') });
    assert.deepEqual(result.call_counts, { version: 3, zero_to_four: 3, five_or_more: 1, unknown: 0, dnc: 0 });
    assert.equal(result.unique_numbers, 1);
});
test('counts repeats within and across files, excluding blank numbers', async () => {
    const exports = { '1': header + '1\t1\t(555) 123-4567\n2\t1\t5551234567\n3\t1\t\n',
        '2': header + '4\t2\t5551234567\textra trailing text\n5\t2\t5557654321\n' };
    const progress = [];
    const result = await scanDuplicates({ ...config, lists: [{ list_id: '1', total_leads: 3 }, { list_id: '2', total_leads: 2 }],
        progress: p => progress.push(p), fetchImpl: async (url, options) => {
            assert.equal(options.method, 'GET');
            assert.equal(url.pathname, '/vicidial/list_download.php');
            return new Response(exports[url.searchParams.get('list_id')]);
        } });
    assert.equal(result.total_records, 5);
    assert.equal(result.unique_numbers, 2);
    assert.equal(result.duplicate_entries, 2);
    assert.equal(result.missing_numbers, 1);
    assert.equal(progress.length, 2);
    assert.equal(JSON.stringify(result).includes('555'), false);
});

test('rejects permission pages, truncated exports, and records from another list', async () => {
    for (const body of ['No list download permission', header + '1\t1\t555\n', header + '1\t2\t555\n2\t2\t555\n']) {
        await assert.rejects(scanDuplicates({ ...config, lists: [{ list_id: '1', total_leads: 2 }], fetchImpl: async () => new Response(body) }));
    }
});


test('FE 2 scans use their own host, campaign and isolated export paths', async () => {
 const {sources}=require('../src/utils/dialerSources');
 assert.equal(new Set(Object.values(sources).map(s=>s.directory)).size,Object.keys(sources).length);
 assert.equal(new Set(Object.values(sources).map(s=>s.cachePath)).size,Object.keys(sources).length);
 const result=await scanDuplicates({dialerId:'fe2',user:'test',password:'private',lists:[{list_id:'101',total_leads:1}],fetchImpl:async url=>{
 assert.equal(url.origin,'https://balitechfe2s.dialerhosting.com');assert.equal(url.pathname,'/BA12asx/list_download.php');
 return new Response('lead_id\tlist_id\tphone_number\tcalled_count\n1\t101\t5551234567\t2\n');
 }});assert.equal(result.dialer_id,'fe2');assert.equal(result.campaign_id,'001');assert.equal(result.unique_numbers,1);
});
