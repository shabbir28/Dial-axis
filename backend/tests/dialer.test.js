const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLists, createDialerClient } = require('../src/utils/dialer');
const payload = { dialer: 'Test', lists: [
    { list_id: '1', list_name: 'Zero', total_numbers: 0, total_sales: 0, active: false },
    { list_id: '2', list_name: 'Sales', total_numbers: 1000, total_sales: 10, active: true },
] };

test('list totals, ratios, inactive booleans and missing metrics remain accurate', () => {
    const result = normalizeLists(payload);
    assert.deepEqual(result.summary, { total_lists: 2, active: 1, inactive: 1, unknown: 0, total_numbers: 1000, total_sales: 10 });
    assert.equal(result.lists[0].numbers_per_sale, null);
    assert.equal(result.lists[0].sale_percentage, null);
    assert.equal(result.lists[1].numbers_per_sale, 100);
    assert.equal(result.lists[1].sale_percentage, 1);
    assert.equal(result.lists[1].human_answers, null);
    assert.equal(result.lists[1].human_answer_percentage, null);
    assert.throws(() => normalizeLists({ error: 'Unauthorized' }));
    assert.throws(() => normalizeLists({ lists: [payload.lists[0], payload.lists[0]] }));
    assert.throws(() => normalizeLists({ lists: [{ list_id: '1', total_numbers: null }] }));
    assert.equal(normalizeLists({ lists: [] }).summary.total_lists, 0);
});

test('cache coalesces concurrent requests, expires, and marks outage snapshots stale', async () => {
    let clock = 0;
    let calls = 0;
    let fail = false;
    const getLists = createDialerClient({
        now: () => clock,
        config: () => ({ url: 'https://example.test/lists', key: 'private-test-key' }),
        fetchImpl: async (url, options) => {
            calls++;
            assert.equal(url.searchParams.get('key'), 'private-test-key');
            assert.equal(options.redirect, 'error');
            if (fail) throw new Error('private-test-key');
            return { ok: true, json: async () => payload };
        },
    });
    const results = await Promise.all([getLists(), getLists(), getLists()]);
    assert.equal(calls, 1);
    assert.equal(results[0].stale, false);
    assert.equal(JSON.stringify(results).includes('private-test-key'), false);
    await getLists();
    assert.equal(calls, 1);
    clock = 61000;
    fail = true;
    assert.equal((await getLists()).stale, true);
    await getLists();
    assert.equal(calls, 2);
    clock = 122000;
    fail = false;
    assert.equal((await getLists()).stale, false);
    assert.equal(calls, 3);
});

test('unconfigured and upstream failure responses never expose credentials', async () => {
    const unconfigured = createDialerClient({ config: () => ({}) });
    await assert.rejects(unconfigured(), error => error.status === 503);
    const failed = createDialerClient({ config: () => ({ url: 'https://example.test', key: 'secret' }), fetchImpl: async () => ({ ok: false }) });
    await assert.rejects(failed(), /temporarily unavailable/);
});


test('standalone role guard separates viewing from scans and enforces initial password change', () => {
 const guard=require('../src/middleware/moduleAccess')();
 for(const role of ['user','admin','unknown']){
  for(const method of ['GET','POST']){
   let allowed=false,status;const res={status(code){status=code;return this},json(){}};
   guard({user:{role},method,path:method==='POST'?'/duplicates/scan':'/sources'},res,()=>{allowed=true});
   assert.equal(allowed,role!=='unknown'&&(method==='GET'||role!=='user'));
   if(!allowed)assert.equal(status,403);
  }
 }
 let allowed=false,status;const res={status(code){status=code;return this},json(){}};
 guard({user:{role:'admin',must_change_password:true},method:'GET',path:'/sources'},res,()=>{allowed=true});
 assert.equal(allowed,false);assert.equal(status,403);
});
