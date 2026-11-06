import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, ArrowUpRight, RefreshCw } from 'lucide-react';
import api from '../services/api';
import './Dialer.css';

export default function DialerHome() {
    const [sources, setSources] = useState(null);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        api.get('/dialer/sources', { signal: controller.signal }).then(response => {
            if (!controller.signal.aborted) setSources(response.data);
        }).catch(() => { if (!controller.signal.aborted) setError('Could not load dialers. Please retry.'); });
        return () => controller.abort();
    }, [retry]);
    return <div className="dialer-page dialer-home">
        <header className="dialer-home-header">
            <div><span className="dialer-home-eyebrow">CAMPAIGN ANALYTICS</span><h1>Dialers</h1></div>
            <span className="dialer-home-hint">Choose a workspace</span>
        </header>
        {error ? <div role="alert" className="dialer-alert">{error}<button onClick={() => { setError(''); setRetry(value => value + 1); }}>Retry</button></div>
            : !sources ? <div role="status" className="dialer-loading"><RefreshCw size={18} className="animate-spin" />Loading dialers…</div>
                : <div className="dialer-source-grid">{sources.map(source =>
                    <Link key={source.id} to={`/dialer/${source.id}`} className={`dialer-source-card ${source.id}`}>
                        <span className="dialer-source-icon"><Phone size={18} /></span>
                        <div className="dialer-source-copy"><h2>{source.name}</h2><p>{source.campaignName}</p></div>
                        <ArrowUpRight size={17} className="dialer-source-arrow" />
                        <footer><span>Campaign <b>{source.campaignId}</b></span><strong>View stats <span aria-hidden="true">→</span></strong></footer>
                    </Link>
                )}</div>}
    </div>;
}
