const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCampaignReport, parseCampaignSales, createReportClient, reportOverview } = require('../src/utils/dialerReport');

test('overview uses report sales and human answers with the uploaded-lead denominator', () => {
    const report = { ...parseCampaignReport(html), stale: true, synced_at: '2026-11-05T00:00:00Z' };
    const overview = reportOverview(report);
    assert.equal(overview.summary.total_lists, 1);
    assert.equal(overview.summary.total_numbers, 100);
    assert.equal(overview.summary.total_sales, 2);
    assert.equal(overview.lists[0].numbers_per_sale, 50);
    assert.equal(overview.lists[0].human_answers, 50);
    assert.equal(overview.lists[0].human_answer_percentage, 50);
    assert.equal(overview.lists[0].dial_attempts, null);
    assert.equal(overview.human_answer_basis, 'uploaded_numbers');
    assert.equal(overview.stale, true);
    assert.equal(overview.synced_at, report.synced_at);
});

const html = `<select name="group[]"><option selected value="001">001 - Bismillah</option><option value="002">002</option></select>
<pre><font>Lists Campaign Status Stats 2026-11-05 12:00:00
LIST ID SUMMARY
| 3001 - Sample &amp; file | 100 | ACTIVE |
PER LIST DETAIL STATS
| 3001 - Sample &amp; file ACTIVE |
| TOTAL LEADS: 100 |
| STATUS FLAGS BREAKDOWN: |
| Human Answer: 50 50.00% |
| Sale: 2 2.00% |
| DNC: 9 9.00% |
| Customer Contact: 20 20.00% |
| Not Interested: 4 4.00% |
| Unworkable: 10 10.00% |
| Sched Callbacks: 1 1.00% |
| Completed: 21 21.00% |
| STATUS BREAKDOWN: | COUNT |
| NEW | New Lead | 95 |
| DNC | DO NOT CALL | 3 |
| SALE | Sale Made | 2 |
| TOTAL: | 100 |
Run Time: 2 seconds</font></pre>`;

const salesHtml = `LISTS WITHIN THIS CAMPAIGN:
<a href="admin.php?ADD=34&campaign_id=001&show_saleha_stats=Y">Stats</a>
<table><tr><td>LIST ID</td><td>Sale/HA</td></tr>
<tr><td><a>3001</a></td><td>Sample</td><td>Description</td><td>100</td><td>2</td><td>71</td><td>1/36</td><td>campaign</td><td>Y</td></tr></table>`;

test('FE report stays scoped to campaign 1002 and handles transfer columns and empty ratios', async () => {
    const { sources } = require('../src/utils/dialerSources');
    const feReport = html.replace('selected value="001"', 'selected value="1002"').replace('<option value="002">', '<option selected value="002">');
    const feSales = salesHtml.replace('campaign_id=001&show_saleha_stats=Y', 'campaign_id=1002&ha_stats=1&show_lead_count=1')
        .replace('<tr><td>LIST ID</td><td>Sale/HA</td></tr>', '<tr><td>LIST ID</td><td>LIST NAME</td><td>DESCRIPTION</td><td>LEADS COUNT</td><td>Sales</td><td>HA</td><td>Sale/HA</td><td>XFER</td><td>RAXFER</td><td>Call Time</td><td>ACTIVE</td></tr>')
        .replace('<td>campaign</td><td>Y</td>', '<td>9</td><td>2</td><td>campaign</td><td>N</td>');
    const fe = createReportClient({ dialer: sources.fe, config: () => ({ user: 'FE_TEST', password: 'private' }), fetchImpl: async (url, options) => {
        assert.equal(url.origin, 'https://balitechfe.dialerhosting.com');
        assert.ok(url.pathname.startsWith('/BcVBcXr/'));
        assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('FE_TEST:private').toString('base64'));
        if (url.pathname.endsWith('admin.php')) {
            assert.equal(url.searchParams.get('campaign_id'), '1002');
            assert.equal(url.searchParams.get('ha_stats'), '1');
        } else assert.deepEqual(url.searchParams.getAll('group[]'), ['1002']);
        return { ok: true, text: async () => url.pathname.endsWith('admin.php') ? feSales : feReport };
    } });
    const report = await fe();
    assert.equal(report.campaign_id, '1002');
    assert.equal(reportOverview(report).dialer, 'FE');
    assert.equal(report.lists[0].active, false);
    assert.equal(report.lists[0].sale_ha, '1/36');
    assert.throws(() => parseCampaignReport(feReport, sources.t6));
    assert.throws(() => parseCampaignReport(feReport.replace('value="1002"', 'value="1003"'), sources.fe));
    const empty = parseCampaignSales(feSales.replace('<td>2</td><td>71</td>', '<td>0</td><td>0</td>').replace('1/36', '---'), sources.fe);
    assert.equal(empty[0].human_answers_per_sale, null);
    assert.notEqual(sources.fe.directory, sources.t6.directory);
    assert.notEqual(sources.fe.cachePath, sources.t6.cachePath);
});

test('campaign ratio preserves dialer rounding and separates campaign HA from report flags', () => {
    const [sales] = parseCampaignSales(salesHtml);
    assert.equal(sales.sale_ha, '1/36');
    assert.equal(sales.human_answers_per_sale, 36);
    assert.equal(sales.human_answers, 71);
    const zero = parseCampaignSales(salesHtml.replace('<td>1/36</td>', '<td>0</td>'))[0];
    assert.equal(zero.sale_ha, '0');
    assert.equal(zero.human_answers_per_sale, null);
    assert.throws(() => parseCampaignSales(salesHtml.replace('campaign_id=001', 'campaign_id=002')));
    assert.throws(() => parseCampaignSales(salesHtml.replace('1/36', 'unknown')));
    assert.throws(() => parseCampaignSales('Login incorrect'));
});

test('report preserves all flags and status codes without conflating DNC flag and DNC code', () => {
    const report = parseCampaignReport(html);
    assert.equal(report.campaign_id, '001');
    const list = report.lists[0];
    assert.equal(list.list_name, 'Sample & file');
    assert.equal(list.flags.length, 8);
    assert.equal(list.flags.find(flag => flag.label === 'DNC').count, 9);
    assert.equal(list.statuses.find(status => status.code === 'DNC').count, 3);
    assert.equal(list.status_total, 100);
    assert.equal(list.numbers_per_sale, 50);
    assert.equal(list.active, true);
    const zeroSales = parseCampaignReport(html.replace('| Sale: 2 2.00%', '| Sale: 0 0.00%'));
    assert.equal(zeroSales.lists[0].numbers_per_sale, null);
});

test('wrong campaign, incomplete flags, truncated report and missing list coverage are rejected', () => {
    assert.throws(() => parseCampaignReport(html.replace('selected value="001"', 'selected value="002"')));
    assert.throws(() => parseCampaignReport(html.replace('| Human Answer: 50 50.00% |', '')));
    assert.throws(() => parseCampaignReport(html.replace('</pre>', '')));
    assert.throws(() => parseCampaignReport(html.replace('| TOTAL: | 100 |', '')));
    assert.throws(() => parseCampaignReport(html.replace('PER LIST DETAIL STATS', '| 3002 - Missing | 12 | INACTIVE |\nPER LIST DETAIL STATS')));
    assert.throws(() => parseCampaignReport('Login incorrect'));
});

test('report client only GETs campaign 001, shares cache, retains stale snapshot and recovers', async () => {
    let clock = 0;
    let calls = 0;
    let fail = false;
    const getReport = createReportClient({
        now: () => clock, config: () => ({ user: 'test', password: 'private' }),
        fetchImpl: async (url, options) => {
            calls++;
            assert.equal(url.origin, 'https://balit6voice.i5.tel');
            if (url.pathname === '/vicidial/admin.php') {
                assert.equal(url.searchParams.get('ADD'), '34');
                assert.equal(url.searchParams.get('campaign_id'), '001');
                assert.equal(url.searchParams.get('show_saleha_stats'), 'Y');
            } else {
                assert.equal(url.pathname, '/vicidial/AST_LISTS_campaign_stats.php');
                assert.deepEqual(url.searchParams.getAll('group[]'), ['001']);
            }
            assert.equal(options.method, 'GET');
            assert.equal(options.redirect, 'error');
            assert.ok(options.headers.Authorization.startsWith('Basic '));
            if (fail) throw new Error('private');
            return { ok: true, text: async () => url.pathname === '/vicidial/admin.php' ? salesHtml : html };
        },
    });
    const results = await Promise.all([getReport(), getReport()]);
    assert.equal(calls, 2);
    const overview = reportOverview(results[0]);
    assert.equal(overview.lists[0].sale_ha, '1/36');
    assert.equal(overview.lists[0].human_answers_per_sale, 36);
    assert.equal(overview.lists[0].human_answers, 71);
    assert.equal(results[0].lists[0].flags.find(flag => flag.label === 'Human Answer').count, 50);
    assert.equal(JSON.stringify(results).includes('private'), false);
    clock = 121000;
    fail = true;
    assert.equal((await getReport()).stale, true);
    assert.equal((await getReport()).stale, true);
    assert.equal(calls, 3);
    clock = 182000;
    fail = false;
    assert.equal((await getReport()).stale, false);
    assert.equal(calls, 5);
});

test('configuration and report failures return safe messages and permit retry', async () => {
    await assert.rejects(createReportClient({ config: () => ({}) })(), error => error.status === 503);
    let clock = 0;
    let calls = 0;
    const getReport = createReportClient({ now: () => clock, config: () => ({ user: 'test', password: 'private' }), fetchImpl: () => {
        calls++;
        throw new Error('private');
    } });
    await assert.rejects(getReport(), /Could not read campaign 001/);
    clock = 61000;
    await assert.rejects(getReport(), /Could not read campaign 001/);
    assert.equal(calls, 2);
});

test('explicit refresh updates active and inactive files from one campaign snapshot and backs off on failure', async () => {
    let clock = 0;
    let calls = 0;
    let campaign = salesHtml;
    let fail = false;
    const getReport = createReportClient({ now: () => clock, config: () => ({ user: 'test', password: 'private' }),
        fetchImpl: async url => {
            calls++;
            if (fail) throw new Error('offline');
            return { ok: true, text: async () => url.pathname.endsWith('admin.php') ? campaign : html };
        },
    });
    assert.equal((await getReport()).lists[0].active, true);
    campaign = salesHtml.replace('<td>Y</td>', '<td>N</td>').replace('<td>100</td>', '<td>120</td>').replace('<td>1/36</td>', '<td>1/40</td>');
    clock = 5_000;
    assert.equal((await getReport({ refresh: true })).lists[0].active, true);
    assert.equal(calls, 2);
    clock = 11_000;
    assert.equal((await getReport()).lists[0].active, true);
    const [fresh] = await Promise.all([getReport({ refresh: true }), getReport({ refresh: true })]);
    assert.equal(calls, 4);
    assert.equal(fresh.lists[0].active, false);
    assert.equal(fresh.lists[0].total_leads, 120);
    assert.equal(fresh.lists[0].sale_ha, '1/40');
    assert.equal(reportOverview(fresh).summary.inactive, 1);
    clock = 22_000;
    fail = true;
    assert.equal((await getReport({ refresh: true })).stale, true);
    assert.equal((await getReport()).stale, true);
    assert.equal((await getReport({ refresh: true })).stale, true);
    assert.equal(calls, 5);
});


test('scheduled reads expire and manual refresh fetches changed sales without HTTP caching', async () => {
    let clock = 0;
    let count = 0;
    let campaign = salesHtml;
    const client = createReportClient({ now: () => clock, config: () => ({ user: 'test', password: 'private' }),
        fetchImpl: async (url, options) => {
            count++;
            assert.equal(options.cache, 'no-store');
            assert.equal(options.headers['Cache-Control'], 'no-cache');
            assert.equal(url.searchParams.get('_crm_refresh'), String(clock));
            return { ok: true, text: async () => url.pathname.endsWith('admin.php') ? campaign : html };
        },
    });
    const before = reportOverview(await client()).lists[0].total_sales;
    campaign = salesHtml.replace('<td>2</td>', '<td>194</td>');
    clock = 120_001;
    assert.equal(reportOverview(await client()).lists[0].total_sales, 194);
    assert.notEqual(before, 194);
    assert.equal(count, 4);
    campaign = campaign.replace('<td>194</td>', '<td>195</td>');
    clock += 11_000;
    const fresh = await Promise.all([client({ refresh: true }), client({ refresh: true })]);
    assert.equal(reportOverview(fresh[0]).lists[0].total_sales, 195);
    assert.equal(count, 6);
});
