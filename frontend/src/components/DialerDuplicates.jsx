import { useAuth } from '../context/AuthContext';
import { createElement, useEffect, useRef, useState } from 'react';
import { RefreshCw, Download, Users, Copy, Database, Check, Phone, PhoneCall, Ban } from 'lucide-react';
import api from '../services/api';
import DialerStatusDetails from './DialerStatusDetails';

const number = value => value == null ? '—' : value.toLocaleString('en-US');

export default function DialerDuplicates({ uploaded, apiBase, campaignId }) {
    const { user } = useAuth();
    const [job, setJob] = useState(null);
    const downloadRequest = useRef(null);
    const [statusKind, setStatusKind] = useState(null);
    const [error, setError] = useState('');
    const [starting, setStarting] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [downloadError, setDownloadError] = useState('');
    useEffect(() => {
        let stopped = false;
        let timer;
        const controller = new AbortController();
        async function poll() {
            try {
                const response = await api.get(`${apiBase}/duplicates`, { signal: controller.signal });
                if (!stopped) { setJob(response.data); setError(''); }
            } catch {
                if (!stopped) setError('Could not check scan status. Retrying…');
            } finally {
                if (!stopped) timer = setTimeout(poll, 5000);
            }
        }
        poll();
        return () => { stopped = true; controller.abort(); downloadRequest.current?.abort(); clearTimeout(timer); };
    }, [apiBase]);
    async function scan() {
        setStarting(true);
        setError('');
        try { setJob((await api.post(`${apiBase}/duplicates/scan`)).data); }
        catch (err) { setError(err.response?.data?.message || 'Could not start scan. Please retry.'); }
        finally { setStarting(false); }
    }
    const result = job?.result;
    const running = job?.status === 'running';
    const downloadReady = result?.export_id && result.export_version === 3;
    const cooldown = job && Date.parse(job.retry_at) > Date.now();
    async function download(kind) {
        if (downloadRequest.current) return;
        const controller = new AbortController();
        downloadRequest.current = controller;
        setDownloading(kind);
        setDownloadError('');
        try {
            const { data } = await api.get(`${apiBase}/duplicates/${kind}/download`, { timeout: 180000, signal: controller.signal });
            if (controller.signal.aborted) return;
            if (!data.csv) throw new Error('No numbers are available in this export.');
            const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url; link.download = data.fileName; document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) { if (!controller.signal.aborted) setDownloadError(err.response?.data?.message || err.message || 'Download failed. Please retry.'); }
        finally { downloadRequest.current = null; if (!controller.signal.aborted) setDownloading(null); }
    }
    const cards = [
        { key: 'unique', label: 'Unique numbers', value: result?.unique_numbers, icon: Users, note: 'View status counts ↗', tone: 'mint' },
        { key: 'duplicates', label: 'Duplicate entries', value: result?.duplicate_entries, icon: Copy, note: 'View status counts ↗', tone: 'amber' },
        { key: 'total', label: 'Records scanned', value: result?.total_records, icon: Database, note: `${result?.total_lists ?? '—'} active & inactive files`, tone: 'blue' },
        { key: 'under5', label: 'Call count 1–4', value: result?.occurrence_counts?.zero_to_four, icon: Phone, note: 'DNC excluded', tone: 'violet' },
        { key: 'over5', label: 'Call count 5+', value: result?.occurrence_counts?.five_or_more, icon: PhoneCall, note: 'DNC excluded', tone: 'rose' },
        { key: 'dnc', label: 'DNC numbers', value: result?.occurrence_counts?.dnc, icon: Ban, note: 'Dialer DNC status', tone: 'red' },
    ];
    return <section className="dialer-dedup" aria-label="Unique and duplicate numbers">
        <div className="dialer-dedup-heading"><div><h2>Number quality <small>CAMPAIGN {campaignId}</small></h2></div>
            <button className="dialer-refresh" onClick={scan} disabled={user.role === 'user' || !job || starting || running || cooldown} title={user.role === 'user' ? 'Only admins can start scans' : 'Refresh number inventory'}><RefreshCw size={14} className={running ? 'animate-spin' : ''} />{running ? 'Scanning…' : result ? 'Scan again' : 'Scan numbers'}</button></div>
        <div className="dialer-quality-grid" role="region" aria-label="Number quality KPI cards" tabIndex={0}>
            {cards.map(({key, label, value, icon: Icon, note, tone}) => <article key={key} className={`dialer-quality-card ${tone} ${['unique', 'duplicates'].includes(key) ? 'has-status-details' : ''}`}>
                {['unique', 'duplicates'].includes(key) && <button className="dialer-status-open" disabled={!downloadReady} aria-label={`View ${label} status counts`} aria-haspopup="dialog" onClick={() => setStatusKind(key)} />}
                <div className="dialer-quality-top"><span className="dialer-quality-icon">{createElement(Icon, { size: 17 })}</span><span>{label}</span>
                    {key !== 'total' && <button className="dialer-quality-download" aria-label={`Download ${label} CSV`} title={downloadReady ? `Download ${label} CSV` : 'Run a scan to prepare CSV files'} disabled={!downloadReady || !!downloading} onClick={() => download(key)}>{downloading === key ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}</button>}</div>
                <strong>{number(value)}</strong><div className="dialer-quality-bottom"><span>{note}</span>{key !== 'total' && value != null && result?.total_records > 0 && <b>{(value / result.total_records * 100).toFixed(1)}%</b>}</div>
            </article>)}
        </div>
        {running && <progress className="dialer-quality-progress" aria-label="Files scanned" value={job.completed} max={job.total_lists || 1} />}
        <p role="status" className="dialer-quality-status"><Check size={13} />{running ? `Scanned ${job.completed} / ${job.total_lists ?? '…'} files · ${number(job.scanned_records)} records.` : result ? `Scanned ${new Date(result.scanned_at).toLocaleString()}` : 'Scan numbers to prepare counts and CSV downloads.'}
            {!running && cooldown && ' Next scan available at ' + new Date(job.retry_at).toLocaleTimeString() + '.'}
            {result && Number.isFinite(uploaded) && result.total_records !== uploaded && ' Uploaded total has changed; run a new scan.'}</p>
        {(downloadError || error || job?.error) && <p role="alert" className="dialer-alert">{downloadError || error || job.error}</p>}
        {statusKind && <DialerStatusDetails apiBase={apiBase} key={statusKind} kind={statusKind} onClose={() => setStatusKind(null)} />}
    </section>;
}
