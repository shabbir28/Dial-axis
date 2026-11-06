import './Login.css';
import PoweredBy from '../components/PoweredBy';
import {useState} from 'react';
import {Navigate,useNavigate} from 'react-router-dom';
import {PhoneCall,ArrowRight,Eye,EyeOff,LockKeyhole,UserRound} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
export default function Login(){
 const {user,login}=useAuth(),navigate=useNavigate();
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(user)return <Navigate to={user.must_change_password?'/setup-password':'/dashboard'} replace/>;
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{const u=await login(username,password);navigate(u.must_change_password?'/setup-password':'/dashboard',{replace:true});}catch(err){setError(err.response?.data?.message||'Cannot connect. Please try again.');}finally{setBusy(false);}}
 return <main className="signin-page workspace-dark">
 <section className="signin-panel" aria-labelledby="signin-title"><div className="signin-brand"><span><PhoneCall size={21}/></span><div><h1 id="signin-title">DialAxis</h1><p>Sign in to your workspace</p></div></div>
   <form onSubmit={submit} className="signin-form">
    {error&&<p role="alert" className="error">{error}</p>}
    <label><span className="label">Username</span><div className="signin-input"><UserRound size={16}/><input autoComplete="username" required maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter your username"/></div></label>
    <label><span className="label">Password</span><div className="signin-input"><LockKeyhole size={16}/><input type={visible?'text':'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
    <button className="primary signin-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}<ArrowRight size={16}/></button>
   </form><p className="signin-help">Need access? Contact your administrator.</p>
   <footer className="signin-partner"><PoweredBy/></footer>
  </section>

 </main>;
}
