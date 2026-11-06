import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, FileText } from 'lucide-react';
import api from '../services/api';

const number = value => value == null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 });

export default function DialerFileDetails({ file, onClose, apiBase, syncedAt }) {
    const dialog = useRef(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const element = dialog.current;
        element.showModal();
        return () => element.close();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError('');
            try {
                const response = await api.get(`${apiBase}/lists/${encodeURIComponent(file.list_id)}/stats`, {
                    signal: controller.signal, timeout: 75000, params: refresh > 0 ? { refresh: '1' } : undefined,
                });
                if (!controller.signal.aborted) setData(response.data);
            } catch (err) {
                if (!controller.signal.aborted) setError(err.response?.data?.message || 'File statistics could not be loaded. Please retry.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        load();
        return () => controller.abort();
    }, [file.list_id, refresh, apiBase, syncedAt]);

    const list = data?.list;
    return (
        <dialog ref={dialog} className="dialer-detail-dialog" aria-labelledby="dialer-detail-title" onCancel={event => { event.preventDefault(); onClose(); }}>
            <div className="dialer-detail-header">
                <FileText size={19} />
                <div><span>FILE STATISTICS · #{file.list_id}</span><h2 id="dialer-detail-title">{list?.list_name || file.list_name}</h2></div>
                <button type="button" aria-label="Close file statistics" onClick={onClose}><X size={19} /></button>
            </div>
            <div className="dialer-detail-body">
                <div className="dialer-detail-context"><span>{data?.campaign_id || '—'} · {data?.campaign_name || 'Campaign'}</span><button disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} />{loading ? 'Loading' : 'Refresh'}</button></div>
                {loading && !list && <div className="dialer-loading" role="status"><RefreshCw size={18} className="animate-spin" />Reading file statistics…</div>}
                {error && <div className="dialer-alert" role="alert">{error}{list && ' Showing the previous report.'}</div>}
                {data?.stale && <div className="dialer-alert" role="alert">Report connection unavailable. Showing saved statistics from {new Date(data.synced_at).toLocaleString()}.</div>}
                {list && <>
                    <div className="dialer-detail-totals">
                        <div><span>Total leads</span><strong>{number(list.total_leads)}</strong></div>
                        <div><span>Sale / HA</span><strong className="dialer-leading">{list.sale_ha || '—'}</strong></div>
                        <div><span>List status</span><strong className={list.active ? 'dialer-leading' : ''}>{list.active ? 'Active' : 'Inactive'}</strong></div>
                    </div>
                    <p className="dialer-detail-note">Campaign HA {number(list.campaign_human_answers)} · Campaign sales {number(list.campaign_sales)}. Sale/HA uses campaign statistics.</p>
                    <div className="dialer-detail-section"><h3>Status flags</h3><span>% of total leads</span></div>
                    <div className="dialer-flags">
                        {list.flags.map(flag => <div className="dialer-flag" data-flag={flag.label} key={flag.label}>
                            <span>{flag.label === 'Sched Callbacks' ? 'Scheduled callbacks' : flag.label}</span>
                            <div><strong>{number(flag.count)}</strong><small>{flag.percentage.toFixed(2)}%</small></div>
                            <div className="dialer-flag-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, flag.percentage))}%` }} /></div>
                        </div>)}
                    </div>
                    <p className="dialer-detail-note">Flags can overlap. Counts and percentages match the dialer report.</p>
                    <div className="dialer-detail-section"><h3>All status codes</h3><span>{list.statuses.length} statuses</span></div>
                    <div className="dialer-detail-statuses">
                        <table className="dialer-table"><thead><tr><th scope="col">Code</th><th scope="col">Description</th><th scope="col" className="numeric">Leads</th><th scope="col" className="numeric">% of leads</th></tr></thead>
                            <tbody>{list.statuses.map(status => <tr key={status.code}><td><code>{status.code}</code></td><td>{status.description || '—'}</td><td className="numeric">{number(status.count)}</td><td className="numeric">{list.total_leads > 0 ? `${(status.count / list.total_leads * 100).toFixed(2)}%` : '—'}</td></tr>)}</tbody>
                            <tfoot><tr><td colSpan={2}>Reported status total</td><td className="numeric">{number(list.status_total)}</td><td /></tr></tfoot>
                        </table>
                    </div>
                    <p className="dialer-detail-note">Dialer report time · {data.report_time}</p>
                </>}
            </div>
        </dialog>
    );
}
