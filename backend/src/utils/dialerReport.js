const { sources } = require('./dialerSources');
const FLAG_NAMES = ['Human Answer', 'Sale', 'DNC', 'Customer Contact', 'Not Interested', 'Unworkable', 'Sched Callbacks', 'Completed'];
const { normalizeLists } = require('./dialer');

function parseCampaignSales(html, dialer = sources.t6) {
    const start = html.indexOf('LISTS WITHIN THIS CAMPAIGN:');
    const section = html.slice(start).split(/<\/table>/i)[0];
    if (start < 0 || !decodeText(section).includes(`campaign_id=${dialer.campaignId}&${new URLSearchParams(dialer.salesParams).toString()}`) || !/Sale\/HA/.test(section)) throw new Error('Missing campaign sales statistics');
    let activeIndex = 8;
    const lists = [...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
        const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => decodeText(cell[1].replace(/<[^>]*>/g, '')).trim());
        if (!/^\d+$/.test(cells[0] || '')) {
            const index = cells.findIndex(cell => cell.replace(/\s+/g, ' ').toUpperCase() === 'ACTIVE');
            if (index >= 0) activeIndex = index;
            return [];
        }
        if (cells.length < 9 || !/^[YN]$/.test(cells[activeIndex]) || !cells.slice(3, 6).every(value => /^\d+$/.test(value)) ||
            (!/^(0|1\/[1-9]\d*)$/.test(cells[6]) && !(cells[6] === '---' && cells[4] === '0'))) throw new Error('Invalid campaign sales row');
        return [{ list_id: cells[0], list_name: cells[1], total_leads: Number(cells[3]), active: cells[activeIndex] === 'Y', sales: Number(cells[4]), human_answers: Number(cells[5]), sale_ha: cells[6],
            human_answers_per_sale: cells[6].startsWith('1/') ? Number(cells[6].slice(2)) : null }];
    });
    if (!lists.length || new Set(lists.map(list => list.list_id)).size !== lists.length) throw new Error('Incomplete campaign sales statistics');
    return lists;
}

function reportOverview(report) {
    const overview = normalizeLists({
        dialer: report.dialer_name || 'BaliT6 Voice', campaign_id: report.campaign_id,
        sales_rule: 'Sales from campaign list statistics',
        lists: report.lists.map(list => ({
            list_id: list.list_id, list_name: list.list_name, active: list.active,
            total_numbers: list.total_leads,
            total_sales: list.campaign_sales ?? list.flags.find(flag => flag.label === 'Sale').count,
            human_answers: list.campaign_human_answers ?? list.flags.find(flag => flag.label === 'Human Answer').count,
        })),
    });
    return {
        ...overview, campaign_name: report.campaign_name,
        report_time: report.report_time, synced_at: report.synced_at, stale: report.stale,
        human_answer_basis: 'uploaded_numbers',
        lists: overview.lists.map(list => ({
            ...list,
            sale_ha: report.lists.find(source => source.list_id === list.list_id).sale_ha ?? null,
            human_answers_per_sale: report.lists.find(source => source.list_id === list.list_id).human_answers_per_sale ?? null,
            human_answer_percentage: list.total_numbers > 0 ? list.human_answers / list.total_numbers * 100 : null,
        })),
    };
}

function decodeText(value) {
    return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
        const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
        if (code[0] !== '#') return named[code.toLowerCase()];
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    });
}

function parseCampaignReport(html, dialer = sources.t6) {
    const campaignSelect = html.match(/<select\b[^>]*name\s*=\s*["']?group\[\][^>]*>([\s\S]*?)<\/select>/i)?.[1];
    const selected = [...(campaignSelect || '').matchAll(/<option\b([^>]*)>/gi)]
        .filter(match => /\bselected\b/i.test(match[1]));
    const selectedIds = selected.map(option => option[1].match(/\bvalue\s*=\s*["']?([^"'\s>]+)/i)?.[1]);
    // FE's report UI marks substring matches selected (002 as well as 1002).
    // The fetched report is also restricted to the authoritative campaign-list IDs below.
    if (!selectedIds.includes(dialer.campaignId) || selectedIds.some(id => id !== dialer.campaignId &&
        !(dialer.selectionSubstringBug && id && dialer.campaignId.includes(id)))) {
        throw new Error('Unexpected report campaign');
    }
    const pre = html.match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
    if (!pre) throw new Error('Missing report');
    const text = decodeText(pre.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '')).replace(/\r/g, '');
    const detailIndex = text.indexOf('PER LIST DETAIL STATS');
    const reportTime = text.match(/Lists Campaign Status Stats\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)?.[1];
    if (detailIndex < 0 || !reportTime || !/Run Time:/.test(text)) throw new Error('Incomplete report');
    const summaryIds = [...text.slice(0, detailIndex).matchAll(/^\|\s*(\d+)\s+-\s+.*\|\s*\d+\s*\|\s*(?:INACTIVE|ACTIVE)\s*\|/gm)].map(match => match[1]);
    const details = text.slice(detailIndex);
    const headers = [...details.matchAll(/^\|\s*(\d+)\s+-\s+(.+?)\s+(INACTIVE|ACTIVE)\s*\|\s*$/gm)];
    const lists = headers.map((header, index) => {
        const block = details.slice(header.index, headers[index + 1]?.index ?? details.length);
        const total = block.match(/TOTAL LEADS:\s*(\d+)/)?.[1];
        const breakdownTotal = block.match(/\|\s*TOTAL:\s*\|\s*(\d+)\s*\|/)?.[1];
        const flags = [...block.matchAll(/^\|\s*([A-Za-z ]+):\s*(\d+)\s+([\d.]+)%\s*\|/gm)]
            .map(match => ({ label: match[1].trim(), count: Number(match[2]), percentage: Number(match[3]) }));
        const statuses = [...block.matchAll(/^\s*\|\s*([\w-]+)\s*\|([^|\n]*)\|\s*(\d+)\s*\|/gm)]
            .map(match => ({ code: match[1], description: match[2].trim(), count: Number(match[3]) }));
        if (total === undefined || breakdownTotal === undefined || flags.length !== FLAG_NAMES.length ||
            FLAG_NAMES.some(name => flags.filter(flag => flag.label === name).length !== 1) ||
            (Number(total) > 0 && !statuses.length)) throw new Error('Incomplete list statistics');
        const sales = flags.find(flag => flag.label === 'Sale').count;
        return {
            list_id: header[1], list_name: header[2].trim(), active: header[3] === 'ACTIVE',
            total_leads: Number(total), flags, statuses, status_total: Number(breakdownTotal),
            numbers_per_sale: sales > 0 && Number(total) > 0 ? Number(total) / sales : null,
        };
    });
    if (!summaryIds.length || lists.length !== summaryIds.length || new Set(summaryIds).size !== summaryIds.length ||
        new Set(lists.map(list => list.list_id)).size !== lists.length ||
        summaryIds.some(id => !lists.some(list => list.list_id === id))) throw new Error('Incomplete list coverage');
    return { dialer_id: dialer.id, dialer_name: dialer.name, campaign_id: dialer.campaignId, campaign_name: dialer.campaignName, report_time: reportTime, lists };
}

function createReportClient({ fetchImpl = fetch, now = Date.now, dialer = sources.t6, config = () => ({
    user: process.env[dialer.userEnv], password: process.env[dialer.passwordEnv],
}) } = {}) {
    let snapshot;
    let validUntil = 0;
    let retryAfter = 0;
    let pending;
    return async function getReport({ refresh = false } = {}) {
        const { user, password } = config();
        if (!user || !password) {
            const error = new Error('Dialer report credentials are not configured on the server.');
            error.status = 503;
            throw error;
        }
        if (pending) return pending;
        if (now() < retryAfter) {
            if (snapshot) return { ...snapshot, stale: true };
            throw new Error('Dialer report temporarily unavailable. Please retry shortly.');
        }
        // Share very recent reads across users, but let an explicit refresh bypass the normal cache.
        if (snapshot && now() < validUntil && (!refresh || now() - Date.parse(snapshot.synced_at) < 10_000)) return { ...snapshot, stale: false };
        // Deferring the request also allows synchronous configuration/fetch failures to clear pending.
        pending = Promise.resolve().then(async () => {
            try {
                const url = new URL('AST_LISTS_campaign_stats.php', dialer.baseUrl);
                url.search = new URLSearchParams({ DB: '0', 'group[]': dialer.campaignId, report_display_type: 'TEXT', SUBMIT: 'SUBMIT' });
                url.searchParams.set('_crm_refresh', String(now()));
                const response = await fetchImpl(url, {
                    method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(45_000),
                    headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'), Accept: 'text/html', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
                });
                if (!response.ok) throw new Error('Report unavailable');
                const report = parseCampaignReport(await response.text(), dialer);
                const salesUrl = new URL('admin.php', dialer.baseUrl);
                salesUrl.search = new URLSearchParams({ ADD: '34', campaign_id: dialer.campaignId, ...dialer.salesParams });
                salesUrl.searchParams.set('_crm_refresh', String(now()));
                const salesResponse = await fetchImpl(salesUrl, {
                    method: 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20_000),
                    headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'), Accept: 'text/html', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
                });
                if (!salesResponse.ok) throw new Error('Campaign sales unavailable');
                const campaignSales = parseCampaignSales(await salesResponse.text(), dialer);
                const campaignIds = new Set(campaignSales.map(list => list.list_id));
                report.lists = report.lists.filter(list => campaignIds.has(list.list_id));
                if (report.lists.length !== campaignSales.length) throw new Error('Incomplete campaign list coverage');
                for (const list of report.lists) {
                    const sales = campaignSales.find(row => row.list_id === list.list_id);
                    if (!sales) throw new Error('Missing campaign sales list');
                    Object.assign(list, { active: sales.active, total_leads: sales.total_leads, list_name: sales.list_name,
                        campaign_sales: sales.sales, campaign_human_answers: sales.human_answers,
                        sale_ha: sales.sale_ha, human_answers_per_sale: sales.human_answers_per_sale });
                }
                snapshot = { ...report, synced_at: new Date(now()).toISOString() };
                validUntil = now() + 120_000;
                return { ...snapshot, stale: false };
            } catch {
                retryAfter = now() + 60_000;
                if (snapshot) return { ...snapshot, stale: true };
                throw new Error(`Could not read campaign ${dialer.campaignId} statistics. Please retry shortly.`);
            }
        }).finally(() => { pending = null; });
        return pending;
    };
}

module.exports = { parseCampaignReport, parseCampaignSales, createReportClient, reportOverview };
