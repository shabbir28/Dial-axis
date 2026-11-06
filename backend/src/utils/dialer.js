const CACHE_MS = 60_000;

function count(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function normalizeLists(payload) {
    if (!payload || !Array.isArray(payload.lists)) throw new Error('Invalid dialer response');
    const ids = new Set();
    const lists = payload.lists.map(row => {
        const id = String(row.list_id ?? '');
        const numbers = count(row.total_numbers);
        const sales = count(row.total_sales);
        if (!id || ids.has(id) || numbers === null || sales === null) throw new Error('Invalid dialer list');
        ids.add(id);
        const human = count(row.human_answers);
        const attempts = count(row.dial_attempts);
        const active = [true, 1, '1', 'Y', 'true'].includes(row.active) ? true
            : [false, 0, '0', 'N', 'false'].includes(row.active) ? false : null;
        return {
            list_id: id, list_name: String(row.list_name ?? id), active,
            total_numbers: numbers, total_sales: sales,
            sale_percentage: numbers > 0 ? sales / numbers * 100 : null,
            numbers_per_sale: sales > 0 && numbers > 0 ? numbers / sales : null,
            human_answers: human, dial_attempts: attempts,
            human_answer_percentage: human !== null && attempts > 0 ? human / attempts * 100 : null,
        };
    });
    return {
        dialer: String(payload.dialer ?? 'Dialer'), campaign_id: String(payload.campaign_id ?? ''),
        sales_rule: String(payload.sales_rule ?? ''),
        source_updated_at: typeof payload.fetched_at === 'string' ? payload.fetched_at : null,
        lists,
        summary: {
            total_lists: lists.length,
            active: lists.filter(row => row.active === true).length,
            inactive: lists.filter(row => row.active === false).length,
            unknown: lists.filter(row => row.active === null).length,
            total_numbers: lists.reduce((sum, row) => sum + row.total_numbers, 0),
            total_sales: lists.reduce((sum, row) => sum + row.total_sales, 0),
        },
    };
}

function createDialerClient({ fetchImpl = fetch, now = Date.now, config = () => ({
    url: process.env.DIALER_LISTS_URL, key: process.env.DIALER_API_KEY,
}) } = {}) {
    let cached;
    let expiresAt = 0;
    let pending;
    let retryAt = 0;
    return async function getLists() {
        const { url, key } = config();
        if (!url || !key) {
            const error = new Error('Dialer connection is not configured on the server.');
            error.status = 503;
            throw error;
        }
        if (cached && now() < expiresAt) return { ...cached, stale: false };
        if (pending) return pending;
        if (now() < retryAt) {
            if (cached) return { ...cached, stale: true };
            throw new Error('Dialer temporarily unavailable');
        }
        pending = (async () => {
            try {
                const target = new URL(url);
                if (target.protocol !== 'https:') throw new Error('HTTPS required');
                target.searchParams.set('key', key);
                const response = await fetchImpl(target, {
                    signal: AbortSignal.timeout(20_000), redirect: 'error',
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) throw new Error('Dialer request failed');
                const data = normalizeLists(await response.json());
                cached = { ...data, synced_at: new Date(now()).toISOString() };
                expiresAt = now() + CACHE_MS;
                return { ...cached, stale: false };
            } catch {
                retryAt = now() + CACHE_MS;
                if (cached) return { ...cached, stale: true };
                throw new Error('Dialer temporarily unavailable. Please try again shortly.');
            } finally {
                pending = null;
            }
        })();
        return pending;
    };
}

module.exports = { normalizeLists, createDialerClient };
