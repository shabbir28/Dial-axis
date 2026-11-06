import { useEffect, useRef, useState } from 'react';
import { X, Search, RefreshCw, ChartNoAxesColumn, Download } from 'lucide-react';
import api from '../services/api';

export default function DialerStatusDetails({ kind, onClose, apiBase }) {
    const dialog = useRef(null);
    const downloadRequest = useRef(null);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [retry, setRetry] = useState(0);
    const [selected, setSelected] = useState([]);
    const [downloading, setDownloading] = useState(null);
    const [downloadError, setDownloadError] = useState('');
    useEffect(() => {
        const element = dialog.current;
        element.showModal();
        return () => { downloadRequest.current?.abort(); element.close(); };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        api.get(`${apiBase}/duplicates/${kind}/statuses`, { signal: controller.signal, timeout: 30000 })
            .then(response => { if (!controller.signal.aborted) setData(response.data); })
            .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Could not load status counts.'); });
        return () => controller.abort();
    }, [kind, retry, apiBase]);
    const statuses = (data?.statuses || []).filter(row => row.status.toLowerCase().includes(search.trim().toLowerCase()));
    const allVisible = statuses.length > 0 && statuses.every(row => selected.includes(row.status));
    const selectedTotal = (data?.statuses || []).filter(row => selected.includes(row.status)).reduce((sum, row) => sum + row.count, 0);
    function toggle(status) {
        setSelected(previous => previous.includes(status) ? previous.filter(value => value !== status) : [...previous, status]);
    }
    function toggleVisible() {
        const visible = statuses.map(row => row.status);
        setSelected(previous => allVisible ? previous.filter(value => !visible.includes(value)) : [...new Set([...previous, ...visible])]);
    }
    async function download(statusesToDownload, busyKey) {
        if (downloadRequest.current) return;
        const controller = new AbortController();
        downloadRequest.current = controller;
        setDownloading(busyKey);
        setDownloadError('');
        try {
            const response = await api.post(`${apiBase}/duplicates/${kind}/statuses/download`, { statuses: statusesToDownload, export_id: data.export_id }, { timeout: 180000, signal: controller.signal });
            if (controller.signal.aborted) return;
            if (typeof response.data.csv !== 'string') throw new Error('Invalid export response.');
            const url = URL.createObjectURL(new Blob([response.data.csv], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url; link.download = response.data.fileName; document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) { if (!controller.signal.aborted) setDownloadError(err.response?.data?.message || 'Download failed. Please retry.'); }
        finally { downloadRequest.current = null; if (!controller.signal.aborted) setDownloading(null); }
    }
    const number = value => value.toLocaleString('en-US');
    return <dialog ref={dialog} className={`dialer-status-dialog ${kind === 'duplicates' ? 'is-duplicates' : ''}`} aria-labelledby="dialer-status-title" onCancel={event => { event.preventDefault(); onClose(); }}>
        <header><span className="dialer-status-emblem"><ChartNoAxesColumn size={17} /></span><div><small>STATUS BREAKDOWN</small><h2 id="dialer-status-title">{kind === 'unique' ? 'Unique numbers' : 'Duplicate entries'}</h2></div><button aria-label="Close status breakdown" onClick={onClose}><X size={17} /></button></header>
        <div className="dialer-status-content">
            {error ? <div role="alert" className="dialer-alert">{error}<button onClick={() => { setError(''); setRetry(value => value + 1); }}>Retry</button></div> : !data ? <div className="dialer-loading" role="status"><RefreshCw size={18} className="animate-spin" />Loading status counts…</div> : <>
                <div className="dialer-status-overview"><div><span>Total records</span><strong>{number(data.total)}</strong></div><div><span>Statuses</span><strong>{data.statuses.length}</strong></div><div><span>Most common</span><strong>{data.statuses[0]?.status || '—'}</strong></div></div>
                <div className="dialer-status-toolbar"><label className="dialer-status-search"><Search size={16} /><input aria-label="Search status" placeholder="Search status…" value={search} onChange={event => setSearch(event.target.value)} /></label><span>{statuses.length} statuses</span></div>
                <div className="dialer-status-selection"><span>{selected.length ? `${selected.length} selected · ${number(selectedTotal)} records` : 'Select statuses to combine'}</span><div><button className="dialer-status-clear" disabled={!selected.length || !!downloading} onClick={() => setSelected([])}>Clear</button><button className="dialer-status-bulk" disabled={!selected.length || !!downloading} onClick={() => download(selected, 'bulk')}>{downloading === 'bulk' ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}Download selected</button></div></div>
                {downloadError && <p role="alert" className="dialer-alert">{downloadError}</p>}
                <div className="dialer-status-table-wrap"><table><thead><tr><th className="dialer-status-check"><input type="checkbox" aria-label="Select all visible statuses" checked={allVisible} ref={element => { if (element) element.indeterminate = !allVisible && statuses.some(row => selected.includes(row.status)); }} disabled={!statuses.length} onChange={toggleVisible} /></th><th>Status</th><th>Total count</th><th>Share</th><th className="dialer-status-action"><span className="sr-only">Download</span></th></tr></thead><tbody>{statuses.map(row => <tr key={row.status} className={selected.includes(row.status) ? 'is-selected' : ''}><td className="dialer-status-check"><input type="checkbox" aria-label={`Select ${row.status}`} checked={selected.includes(row.status)} onChange={() => toggle(row.status)} /></td><td><span className="dialer-status-code">{row.status}</span></td><td>{number(row.count)}</td><td><div className="dialer-status-share"><span className="dialer-status-track"><i style={{ width: `${row.percentage}%` }} /></span><span>{row.percentage.toFixed(2)}%</span></div></td><td className="dialer-status-action"><button aria-label={`Download ${row.status}`} title={`Download ${row.status}`} disabled={!!downloading} onClick={() => download([row.status], row.status)}>{downloading === row.status ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}</button></td></tr>)}</tbody></table>{!statuses.length && <p className="dialer-status-empty">No matching statuses.</p>}</div>
                <footer>Scan: {new Date(data.scanned_at).toLocaleString()}</footer>
            </>}
        </div>
    </dialog>;
}
