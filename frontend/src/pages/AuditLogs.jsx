import {useEffect,useState} from 'react';

import {History,Download,AlertCircle,RefreshCw,Search,ChevronLeft,ChevronRight,ShieldCheck,SlidersHorizontal,ChevronDown,UserRound,ScanLine,Info} from 'lucide-react';

import api from '../services/api';

import './AuditLogs.css';

const initial={q:'',action:'',dialer:'',outcome:'',from:'',to:''};

const names={download:'Download',scan:'Scan requested','user.create':'User created','user.update':'User updated'};

const results={prepared:'Export ready',requested:'Scan requested',completed:'Completed',failed:'Failed / denied',pending:'Pending / unconfirmed'};

const kinds={unique:'Unique numbers',duplicates:'Duplicate entries',under5:'Call count 1–4',over5:'Call count 5+',dnc:'DNC numbers',invalid:'Invalid export'};

export default function AuditLogs(){

 const [filters,setFilters]=useState(initial),[query,setQuery]=useState(''),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[expanded,setExpanded]=useState(null);

 useEffect(()=>{const t=setTimeout(()=>setQuery(filters.q),350);return()=>clearTimeout(t);},[filters.q]);

 useEffect(()=>{

  const controller=new AbortController();setLoading(true);setError('');

  const params={page,q:query,action:filters.action,dialer:filters.dialer,outcome:filters.outcome};

  if(filters.from)params.from=new Date(filters.from+'T00:00:00').toISOString();

  if(filters.to){const end=new Date(filters.to+'T00:00:00');end.setDate(end.getDate()+1);params.to=end.toISOString();}

  api.get('/audit',{params,signal:controller.signal}).then(r=>{if(!controller.signal.aborted)setData(r.data);}).catch(e=>{if(!controller.signal.aborted)setError(e.response?.data?.message||'Could not load audit logs.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});

  return()=>controller.abort();

 },[query,filters.action,filters.dialer,filters.outcome,filters.from,filters.to,page,retry]);

 function change(key,value){setFilters(f=>({...f,[key]:value}));setPage(1);setExpanded(null);}

 return <section className="audit-page"><header className="audit-page-heading"><div className="audit-title"><span className="audit-title-icon"><ShieldCheck size={22}/></span><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-300">Workspace activity</p><h2 className="mt-1.5 text-2xl font-semibold tracking-tight">Audit logs</h2><p className="mt-2 text-xs text-zinc-500">Track team activity, exports and account changes.</p></div></div><button className="secondary" disabled={loading} onClick={()=>setRetry(v=>v+1)}><RefreshCw size={14} className={loading?'animate-spin':''}/>Refresh logs</button></header>

 {error&&<p role="alert" className="error">{error}</p>}

 <div className="audit-metrics">{[['Matching events',data?.summary.total,History,'text-indigo-300'],['Exports ready',data?.summary.downloads,Download,'text-emerald-400'],['Failed / denied',data?.summary.failed,AlertCircle,'text-rose-300']].map(([label,value,Icon,color])=><div className="audit-metric" key={label}><span className={'audit-metric-icon '+color}><Icon size={18}/></span><div><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value==null?'—':value.toLocaleString()}</p></div></div>)}</div>

 <section className="audit-feed"><header className="audit-feed-heading"><div><History size={16}/><h3>Activity log</h3><span className="audit-count">{data?.summary.total?.toLocaleString()??'—'}</span></div><span className="audit-readonly"><ShieldCheck size={12}/>Read-only record</span></header><div className="audit-filter-heading"><SlidersHorizontal size={13}/><span>Filter activity</span></div><div className="audit-filters"><label className="block"><span className="label">User</span><div className="audit-search"><Search size={13}/><input className="min-w-0 w-full bg-transparent text-xs text-zinc-100 outline-none" aria-label="Search audit user" placeholder="Username…" maxLength={64} value={filters.q} onChange={e=>change('q',e.target.value)}/></div></label>

 {[

 ['action','Action',[['download','Downloads'],['scan','Scans'],['user.create','Create user'],['user.update','Update user']]],

 ['dialer','Dialer',[['t6','BaliT6 Voice'],['fe','FE'],['fe2','FE2 S']]],

 ['outcome','Result',Object.entries(results)]

 ].map(([key,label,options])=><label key={key}><span className="label">{label}</span><select aria-label={label} className="field !w-auto !py-2 !text-xs" value={filters[key]} onChange={e=>change(key,e.target.value)}><option value="">All</option>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>)}

 {['from','to'].map(key=><label key={key}><span className="label">{key==='from'?'From date':'To date'}</span><input type="date" aria-label={key==='from'?'From date':'To date'} className="field !w-auto !py-2 !text-xs [color-scheme:dark]" value={filters[key]} max={key==='from'?filters.to||undefined:undefined} min={key==='to'?filters.from||undefined:undefined} onChange={e=>change(key,e.target.value)}/></label>)}

 <button className="secondary" onClick={()=>{setFilters(initial);setQuery('');setPage(1);setExpanded(null);}}>Reset</button></div>

 <div className="audit-table-scroll"><table className="audit-table" aria-label="Audit activity" aria-busy={loading}><thead className="bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-500"><tr>{['Time','Team member','Activity','Dialer','Records','Result',''].map((x,i)=><th key={i} className="whitespace-nowrap px-4 py-3 font-medium">{x}</th>)}</tr></thead><tbody>{data?.rows.map(row=><LogRow key={row.id} row={row} expanded={expanded===row.id} toggle={()=>setExpanded(expanded===row.id?null:row.id)}/>)}</tbody></table></div>

 {loading?<p role="status" className="p-5 text-center text-xs text-zinc-500">Loading activity…</p>:!data?.rows.length&&<div className="p-10 text-center"><History size={26} className="mx-auto mb-3 text-zinc-500"/><p className="text-sm text-zinc-300">No matching activity</p><p className="mt-1 text-xs text-zinc-500">New downloads and actions will appear here.</p></div>}

 <footer className="audit-pagination"><span>{data?.summary.total||0} events · 25 per page</span><div className="flex items-center gap-3"><button className="secondary !p-1" aria-label="Previous audit page" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><span>{page} / {data?.totalPages||1}</span><button className="secondary !p-1" aria-label="Next audit page" disabled={loading||page>=(data?.totalPages||1)} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></footer>

 </section><p className="audit-note"><Info size={14}/> <span>Export ready means the server prepared the CSV; it does not confirm a file was saved on the device. Pending events may have been interrupted. Logging starts from this update.</span></p></section>;

}

function LogRow({row,expanded,toggle}){

 const d=row.details||{};

 const Icon=row.action==='download'?Download:row.action==='scan'?ScanLine:UserRound;

 return <><tr className={expanded?'audit-row is-expanded':'audit-row'}><td className="whitespace-nowrap px-4 py-3 text-zinc-400"><p>{new Date(row.created_at).toLocaleDateString()}</p><p className="mt-1 text-[10px] text-zinc-500">{new Date(row.created_at).toLocaleTimeString()}</p></td><td className="px-4 py-3"><div className="audit-person"><span>{(row.username||'?').slice(0,1).toUpperCase()}</span><div><p>{row.username}</p><small>{row.actor_role}</small></div></div></td><td className="max-w-xs px-4 py-3"><div className="audit-action"><Icon size={14}/><p className="font-medium">{names[row.action]||row.action}</p></div><p className="mt-1 truncate text-[10px] text-zinc-500">{kinds[d.kind]||d.target_username||(d.target_id?'User #'+d.target_id:'Campaign '+(d.campaign_id||'—'))}{d.statuses?.length?' · '+d.statuses.join(', '):''}</p></td><td className="whitespace-nowrap px-4">{row.dialer_id==='fe2'?'FE2 S':row.dialer_id==='fe'?'FE':row.dialer_id==='t6'?'BaliT6 Voice':'—'}</td><td className="px-4 tabular-nums">{d.rows==null?'—':Number(d.rows).toLocaleString()}</td><td className="whitespace-nowrap px-4"><span className={'audit-result '+(row.outcome==='failed'?'bg-rose-400/10 text-rose-300':row.outcome==='pending'?'bg-amber-400/10 text-amber-300':'bg-teal-400/10 text-emerald-400')}>{results[row.outcome]||row.outcome}</span></td><td className="px-3"><button className="secondary !px-2 !py-1" aria-expanded={expanded} aria-label={'Details for event '+row.id} onClick={toggle}><ChevronDown size={15} className={expanded?'audit-chevron open':'audit-chevron'}/><span className="sr-only">{expanded?'Hide':'Details'}</span></button></td></tr>

 {expanded&&<tr className="audit-detail-row"><td colSpan={7} className="px-5 py-4"><dl className="audit-details">{[['Event',row.id],['IP address',row.ip_address],['HTTP status',row.http_status],['File',d.file_name],['Campaign',d.campaign_id],['Selected statuses',d.statuses?.join(', ')],['Scan status',d.job_status],['Target user',d.target_username],['Role change',d.previous_role?d.previous_role+' → '+d.role:d.role],['Active change',typeof d.previous_active==='boolean'?String(d.previous_active)+' → '+String(d.active):null]].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([label,value])=><div key={label}><dt className="text-[10px] text-zinc-500">{label}</dt><dd className="mt-1 break-all text-zinc-300">{value}</dd></div>)}</dl></td></tr>}</>;

}

