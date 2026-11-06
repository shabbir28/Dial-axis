import {NavLink,Outlet,useNavigate,useLocation} from 'react-router-dom';
import {PhoneCall,Users,LogOut,LayoutDashboard,Download,History,Menu,X,ChevronRight} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import PoweredBy from './PoweredBy';
export default function Shell(){
 const {user,logout}=useAuth(),navigate=useNavigate(),location=useLocation();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
 const drawer=useRef(null);
 async function signOut(){setBusy(true);try{await logout();navigate('/login');}catch{setError('Could not sign out. Please retry.');}finally{setBusy(false);}}
 useEffect(()=>{if(open)drawer.current.showModal();else drawer.current.close();},[open]);
 const items=[{path:'/dashboard',label:'Overview',icon:LayoutDashboard},{path:'/dialer',label:'Dialers',icon:PhoneCall},{path:'/downloads',label:'Downloads',icon:Download},...(user.role!=='user'?[{path:'/users',label:'User management',icon:Users},{path:'/audit',label:'Audit logs',icon:History}]:[])];
 const title=items.find(x=>location.pathname.startsWith(x.path))?.label||'Workspace';
 const nav=(mobile=false)=><div className="flex h-full flex-col">
  <NavLink to="/dashboard" onClick={()=>setOpen(false)} className="flex items-center gap-3 border-b border-white/5 px-5 py-6"><span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-300/20 bg-indigo-500 text-white"><PhoneCall size={19}/></span><span><strong className="block text-lg tracking-tight">DialAxis</strong><span className="mt-0.5 block text-[10px] text-zinc-500">CONTACT INTELLIGENCE</span></span></NavLink>
  <div className="px-5 pb-2 pt-7 text-[9px] font-semibold uppercase tracking-[.2em] text-zinc-400">Workspace</div>
  <nav aria-label={mobile?'Mobile navigation':'Main navigation'} className="space-y-1 px-3">{items.map(({path,label,icon:Icon})=><NavLink key={path} to={path} onClick={()=>setOpen(false)} className={({isActive})=>'group flex items-center gap-3 rounded-lg border px-3 py-3 text-xs font-medium transition '+(isActive?'border-indigo-400/20 bg-indigo-400/10 text-indigo-200':'border-transparent text-zinc-400 hover:bg-zinc-900/5 hover:text-slate-100')}><Icon size={16}/>{label}<ChevronRight size={13} className="ml-auto opacity-40"/></NavLink>)}</nav>
  <div className="mt-auto p-3"><div className="mb-4 flex items-center gap-2.5 rounded-xl border border-white/5 bg-zinc-900/[.025] p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-400/15 text-xs font-semibold text-violet-300">{user.display_name.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{user.display_name}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-500">{user.role.replaceAll('_',' ')}</p></div><button className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900/5 hover:text-rose-300" title="Sign out" aria-label="Sign out" onClick={signOut} disabled={busy}><LogOut size={15}/></button></div><PoweredBy className="sidebar-powered"/></div>
 </div>;
 return <div className="min-h-screen"><aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-slate-800/70 bg-[#0c0c0f] lg:block">{nav()}</aside>
 <dialog ref={drawer} className="sidebar-drawer" aria-label="Navigation menu" onCancel={e=>{e.preventDefault();setOpen(false);}}><button aria-label="Close navigation" onClick={()=>setOpen(false)} className="absolute right-2 top-2 p-2 text-zinc-400"><X size={16}/></button>{nav(true)}</dialog>
 <div className="workspace-dark min-h-screen lg:pl-[240px]"><header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur sm:px-7"><button aria-label="Open navigation" className="secondary lg:hidden" onClick={()=>setOpen(true)}><Menu size={18}/></button><span className="hidden text-xs text-zinc-400 sm:inline">Workspace</span><ChevronRight size={13} className="hidden text-zinc-300 sm:block"/><h1 className="text-sm font-semibold text-zinc-200">{title}</h1><span className="ml-auto rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] text-zinc-500">Dialer analytics</span></header>
 {error&&<div role="alert" className="error mx-4 mt-3">{error}</div>}<main className="mx-auto max-w-[1600px] p-4 sm:p-7"><Outlet/></main></div></div>;
}
