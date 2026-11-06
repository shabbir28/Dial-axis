import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Download,ArrowUpRight} from 'lucide-react';
import api from '../services/api';
import DialerDuplicates from '../components/DialerDuplicates';
import './Dialer.css';
export default function Downloads(){
 const [sources,setSources]=useState([]),[selected,setSelected]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');api.get('/dialer/sources',{signal:controller.signal}).then(r=>{setSources(r.data);setSelected(p=>p||r.data[0]?.id||'');}).catch(()=>{if(!controller.signal.aborted)setError('Could not load export sources.');});return()=>controller.abort();},[retry]);
 const source=sources.find(s=>s.id===selected);
 return <section className="space-y-5"><header><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-orange-300">Data library</p><h2 className="mt-1.5 text-2xl font-semibold tracking-tight">Downloads</h2><p className="mt-2 text-xs text-zinc-500">Export numbers by category or select specific statuses from your saved scan.</p></header>
 {error&&<div role="alert" className="error">{error}<button className="ml-3 underline" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>}
 <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">{sources.map(s=><button key={s.id} aria-pressed={s.id===selected} onClick={()=>setSelected(s.id)} className={'rounded-md px-4 py-2 text-xs '+(s.id===selected?'bg-slate-900 text-white':'text-zinc-500 hover:text-zinc-200')}>{s.name}</button>)}</div>{source&&<Link to={'/dialer/'+source.id} className="secondary">View campaign<ArrowUpRight size={13}/></Link>}</div>
 {source?<div className="panel p-3 sm:p-5"><div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-4"><span className="rounded-lg bg-orange-300/10 p-2 text-orange-300"><Download size={18}/></span><div><h3 className="text-sm font-semibold">{source.name}</h3><p className="mt-1 text-[10px] text-zinc-500">{source.campaignId} · {source.campaignName}</p></div></div><div className="dialer-page !m-0 !max-w-none !bg-none !p-0"><DialerDuplicates key={source.id} apiBase={'/dialer/sources/'+source.id} campaignId={source.campaignId}/></div></div>:!error&&<p role="status" className="text-sm text-zinc-500">Loading export sources…</p>}
 <p className="text-[11px] text-zinc-500">Exports use the last completed scan. Click Unique or Duplicate to select statuses; use the download icons for CSV files.</p>
 </section>;
}
