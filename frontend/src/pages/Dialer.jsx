import { Link, Navigate, useParams } from 'react-router-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Phone, Trophy, Files, CirclePlay, CirclePause, Users, Target, Search, ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './Dialer.css';
import api from '../services/api';
import DialerFileDetails from '../components/DialerFileDetails';
import DialerDuplicates from '../components/DialerDuplicates';

const number = value => value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const percent = value => value == null ? '—' : `${value.toFixed(3)}%`;
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Unavailable';

export default function Dialer() {
    const { dialerId } = useParams();
    return ['t6', 'fe', 'fe2'].includes(dialerId) ? <DialerOverview key={dialerId} dialerId={dialerId} /> : <Navigate to="/dialer" replace />;
}

function DialerOverview({ dialerId }) {
    const apiBase = `/dialer/sources/${dialerId}`;
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [metric, setMetric] = useState('all');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('human_answers_per_sale');
    const [minimum, setMinimum] = useState('0');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedFile, setSelectedFile] = useState(null);

    const request = useRef(null);
    const lastRead = useRef(0);

    const refresh = useCallback(async (force = false) => {
        if (request.current) return;
        const controller = new AbortController();
        request.current = controller;
        setLoading(true);
        setError('');
        try {
            const response = await api.get(`${apiBase}/lists`, { signal: controller.signal, timeout: 75000, params: force ? { refresh: '1' } : undefined });
            if (!controller.signal.aborted) { setData(response.data); lastRead.current = Date.now(); }
        } catch (err) {
            if (!controller.signal.aborted) setError(err.response?.data?.message || 'Could not load dialer lists. Please retry.');
        } finally {
            if (request.current === controller) request.current = null;
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [apiBase]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (!document.hidden) refresh(true);
        }, 120_000);
        const onVisible = () => {
            if (!document.hidden && Date.now() - lastRead.current >= 120_000) refresh();
        };
        refresh();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
            request.current?.abort();
            request.current = null;
        };
    }, [refresh]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return (data?.lists || []).filter(row =>
            `${row.list_id} ${row.list_name}`.toLowerCase().includes(term) &&
            (status === 'all' || (status === 'active' && row.active === true) || (status === 'inactive' && row.active === false)) &&
            row.total_numbers >= (Number(minimum) || 0) &&
            (metric !== 'sales' || row.total_sales > 0)
        );
    }, [data, search, status, minimum, metric]);
    const sorted = useMemo(() => [...filtered].sort((a, b) => {
        const difference = sort === 'human_answers_per_sale'
            ? (a.human_answers_per_sale ?? Infinity) - (b.human_answers_per_sale ?? Infinity)
            : (b[sort] ?? -1) - (a[sort] ?? -1);
        return difference || b.total_sales - a.total_sales || a.list_id.localeCompare(b.list_id);
    }), [filtered, sort]);
    const best = [...filtered].filter(row => row.total_sales > 0 && row.human_answers_per_sale > 0)
        .sort((a, b) => a.human_answers_per_sale - b.human_answers_per_sale || b.total_sales - a.total_sales)[0];
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const currentPage = Math.min(page, pages);
    const rows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const hasHuman = data?.lists.some(row => row.human_answers !== null);
    const hasAttempts = data?.lists.some(row => row.dial_attempts !== null);
    const cards = [
        { id: 'all', label: 'Uploaded files', value: data?.summary.total_lists, icon: Files, hint: 'View all files', color: 'blue' },
        { id: 'active', label: 'Active files', value: data?.summary.active, icon: CirclePlay, hint: 'View active files', color: 'green' },
        { id: 'inactive', label: 'Inactive files', value: data?.summary.inactive, icon: CirclePause, hint: 'View inactive files', color: 'slate' },
        { id: 'numbers', label: 'Uploaded numbers', value: data?.summary.total_numbers, icon: Users, hint: 'View largest lists', color: 'violet' },
        { id: 'sales', label: 'Total sales', value: data?.summary.total_sales, icon: Target, hint: 'View files with sales', color: 'orange' },
    ];
    function selectMetric(id) {
        setMetric(id);
        setStatus(id === 'active' || id === 'inactive' ? id : 'all');
        setSort(id === 'numbers' ? 'total_numbers' : id === 'sales' ? 'total_sales' : 'human_answers_per_sale');
        setSearch('');
        setMinimum('0');
        setPage(1);
    }
    const filteredView = search || minimum !== '0' || metric !== 'all' || status !== 'all';

    return (
        <div className="dialer-page">
            <Link className="dialer-back" to="/dialer">← All dialers</Link>
            <header className="dialer-header">
                <div className="dialer-heading">
                    <span className="dialer-logo"><Phone size={20} /></span>
                    <div><h1>{data?.dialer || (dialerId === 'fe2' ? 'FE2 S' : dialerId === 'fe' ? 'FE' : 'BaliT6 Voice')}</h1><p>{data?.dialer || 'File performance'}<span> / </span>Campaign {data?.campaign_id || '—'}</p></div>
                </div>
                <div className="dialer-actions">
                    <span className="dialer-auto-refresh">Auto · 2 min</span>
                    {data && <span className="dialer-sync" title={date(data.synced_at)}><i className={data.stale || error ? 'is-stale' : ''} />{data.stale || error ? 'Last saved data' : 'Updated'} · {date(data.synced_at)}</span>}
                    <button className="dialer-refresh" disabled={loading} onClick={() => refresh(true)}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{loading ? 'Syncing' : 'Refresh'}</button>
                </div>
            </header>
            {error && <div role="alert" className="dialer-alert">{error}{data && ' Showing saved data.'}</div>}
            {data?.stale && <div role="alert" className="dialer-alert">Connection unavailable. Last successful sync {date(data.synced_at)}.</div>}
            {loading && !data && <div role="status" className="dialer-loading"><RefreshCw className="animate-spin" size={20} /> Loading dialer performance…</div>}
            {data && <>
                <div className="dialer-kpis" aria-label="Filter files by metric">
                    {cards.map(({id, label, value, icon: Icon, hint, color}) => (
                        <button key={id} className={'dialer-kpi ' + color + (metric === id ? ' selected' : '')} title={hint} aria-pressed={metric === id} aria-controls="dialer-files" onClick={() => selectMetric(id)}>
                            <span className="dialer-kpi-top"><span>{label}</span>{React.createElement(Icon, { size: 16 })}</span>
                            <strong>{number(value)}</strong>
                            <span className="dialer-kpi-corner"><ArrowUpRight size={13} /></span>
                        </button>
                    ))}
                </div>
                <DialerDuplicates apiBase={apiBase} campaignId={data.campaign_id} uploaded={data.summary.total_numbers} />
                <section className="dialer-files" id="dialer-files" aria-labelledby="dialer-files-title">
                    <div className="dialer-section-heading">
                        <div><h2 id="dialer-files-title">{metric === 'sales' ? 'Files with sales' : status === 'active' ? 'Active files' : status === 'inactive' ? 'Inactive files' : 'File performance'}<span className="dialer-count">{number(sorted.length)}</span></h2><p>Find your strongest lists. Open any file for its complete report.</p></div>
                        <div className="dialer-status-tabs" aria-label="File status">{[
                            ['all', 'All files', data.summary.total_lists], ['active', 'Active', data.summary.active], ['inactive', 'Inactive', data.summary.inactive],
                        ].map(([value, label, count]) => <button key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setMetric(value); setPage(1); }}>{label}<span>{number(count)}</span></button>)}</div>
                    </div>
                    <div className="dialer-toolbar">
                        <label className="dialer-search"><Search size={16} /><input aria-label="Find file" placeholder="Search file name or ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
                        <label className="dialer-field"><span>Rank files by</span><select aria-label="Sort by" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="human_answers_per_sale">Best Sale/HA ratio</option><option value="sale_percentage">Highest sales %</option><option value="total_sales">Most sales</option><option value="total_numbers">Most numbers</option>{hasHuman && <option value="human_answer_percentage">Human-answer ratio</option>}</select></label>
                        <label className="dialer-field dialer-minimum"><span>Minimum leads</span><input aria-label="Minimum uploaded numbers" type="number" min="0" step="1" value={minimum} onChange={e => { setMinimum(e.target.value); setPage(1); }} /></label>
                    </div>
                    {filteredView && <div className="dialer-filter-summary"><span>{number(sorted.length)} matching files</span><button className="dialer-clear" onClick={() => selectMetric('all')}><X size={13} />Reset filters</button></div>}
                    {best && <div className="dialer-best">
                        <span className="dialer-best-icon"><Trophy size={17} /></span>
                        <div className="dialer-best-name"><span>BEST PERFORMING FILE</span><button title="View file statistics" aria-haspopup="dialog" onClick={() => setSelectedFile(best)}>{best.list_name}<ArrowUpRight size={13} /></button><small>List #{best.list_id} · Lowest HA per sale in this selection</small></div>
                        <div className="dialer-best-stat dialer-best-primary"><span>SALE / HA</span><strong>{best.sale_ha || '—'}</strong></div><div className="dialer-best-stat"><span>SALES</span><strong>{number(best.total_sales)}</strong></div>
                    </div>}
                    <div className="dialer-table-scroll" tabIndex={0} role="region" aria-label="Dialer files table">
                        <table className="dialer-table">
                            <thead><tr><th scope="col" className="dialer-rank">#</th><th scope="col">File / List ID</th><th scope="col">Status</th>{[['total_numbers', 'Uploaded'], ['total_sales', 'Sales'], ['human_answers_per_sale', 'Sale / HA'], ['sale_percentage', 'Sales %']].map(([key, label]) => <th key={key} scope="col" className="numeric" aria-sort={sort === key ? (key === 'human_answers_per_sale' ? 'ascending' : 'descending') : 'none'}><button onClick={() => { setSort(key); setPage(1); }} aria-label={'Sort by ' + label}>{label}<span className={sort === key ? 'dialer-sort-active' : ''}>{key === 'human_answers_per_sale' ? '↑' : '↓'}</span></button></th>)}{hasAttempts && <th scope="col" className="numeric">Attempts</th>}{hasHuman && <><th scope="col" className="numeric">Human answers</th><th scope="col" className="numeric">{data.human_answer_basis === 'uploaded_numbers' ? 'Human / uploaded' : 'Human / attempts'}</th></>}</tr></thead>
                            <tbody>{rows.map((row, index) => <tr key={row.list_id} onClick={() => setSelectedFile(row)} className={'dialer-clickable-row ' + (row.list_id === best?.list_id ? 'dialer-top-row' : '')}>
                                <td className="dialer-rank"><span className="dialer-rank-number">{(currentPage - 1) * pageSize + index + 1}</span></td>
                                <td><div className="dialer-file-cell"><span className="dialer-file-avatar"><Files size={16} /></span><div className="dialer-file-copy"><button className="dialer-file-name" title={row.list_name} aria-haspopup="dialog" aria-label={`View statistics for ${row.list_name}, list ${row.list_id}`} onClick={event => { event.stopPropagation(); setSelectedFile(row); }}>{row.list_name}<ArrowUpRight size={12} /></button><span className="dialer-file-id">LIST {row.list_id}</span></div></div></td>
                                <td><span className={'dialer-badge ' + (row.active === true ? 'active' : '')}><i />{row.active === true ? 'Active' : row.active === false ? 'Inactive' : 'Unknown'}</span></td>
                                <td className="numeric">{number(row.total_numbers)}</td><td className="numeric dialer-sales">{number(row.total_sales)}</td>
                                <td className="numeric"><span className={'dialer-ratio-value ' + (row.list_id === best?.list_id ? 'dialer-leading' : '')}>{row.sale_ha || '—'}</span></td><td className="numeric">{percent(row.sale_percentage)}</td>
                                {hasAttempts && <td className="numeric">{number(row.dial_attempts)}</td>}{hasHuman && <><td className="numeric">{number(row.human_answers)}</td><td className="numeric">{percent(row.human_answer_percentage)}</td></>}
                            </tr>)}</tbody>
                        </table>
                        {!rows.length && <div className="dialer-empty"><Search size={24} /><strong>No matching files</strong><span>Try another search or clear your filters.</span><button className="dialer-clear" onClick={() => selectMetric('all')}>Clear filters</button></div>}
                    </div>
                    <footer className="dialer-table-footer"><span>{sorted.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, sorted.length)} of {number(sorted.length)} files</span><div><label className="dialer-page-size">Rows<select aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><button aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button><span>{currentPage} / {pages}</span><button aria-label="Next page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button></div></footer>
                </section>
                <div className="dialer-footnote"><span>Sale/HA · 1/296 means one sale per 296 human answers.</span>{data.summary.unknown > 0 && <span>{data.summary.unknown} files with unknown status</span>}<span title={data.sales_rule}>Sales reported by dialer</span></div>
            </>}
            {selectedFile && <DialerFileDetails syncedAt={data?.synced_at} apiBase={apiBase} key={selectedFile.list_id} file={selectedFile} onClose={() => setSelectedFile(null)} />}
        </div>
    );
}
