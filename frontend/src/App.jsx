import {lazy,Suspense} from 'react';
import {BrowserRouter,Routes,Route,Navigate,Outlet} from 'react-router-dom';
import {AuthProvider,useAuth} from './context/AuthContext';
import Login from './pages/Login';
import Shell from './components/Shell';
const DialerHome=lazy(()=>import('./pages/DialerHome'));
const Dialer=lazy(()=>import('./pages/Dialer'));
const AuditLogs=lazy(()=>import('./pages/AuditLogs'));
const Users=lazy(()=>import('./pages/Users'));
const PasswordSetup=lazy(()=>import('./pages/PasswordSetup'));
const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Downloads=lazy(()=>import('./pages/Downloads'));
function Protected({workspace=false,admin=false}){
 const {user}=useAuth();
 if(!user)return <Navigate to="/login" replace/>;
 if(workspace&&user.must_change_password)return <Navigate to="/setup-password" replace/>;
 if(admin&&user.role==='user')return <Navigate to="/dashboard" replace/>;
 return <Outlet/>;
}
function Router(){
 const {loading,error,retry}=useAuth();
 if(loading)return <div role="status" className="grid min-h-screen place-items-center text-sm text-zinc-400">Opening workspace…</div>;
 if(error)return <div role="alert" className="grid min-h-screen place-content-center gap-4 text-center"><p>{error}</p><button className="primary" onClick={retry}>Retry connection</button></div>;
 return <Suspense fallback={<p role="status" className="p-8 text-sm text-zinc-400">Loading…</p>}><Routes>
 <Route path="/login" element={<Login/>}/>
 <Route element={<Protected/>}><Route path="/setup-password" element={<PasswordSetup/>}/>
 <Route element={<Protected workspace/>}><Route element={<Shell/>}>
 <Route path="/dashboard" element={<Dashboard/>}/><Route path="/downloads" element={<Downloads/>}/>
 <Route path="/dialer" element={<DialerHome/>}/><Route path="/dialer/:dialerId" element={<Dialer/>}/>
 <Route element={<Protected admin/>}><Route path="/users" element={<Users/>}/><Route path="/audit" element={<AuditLogs/>}/></Route>
 </Route></Route></Route><Route path="*" element={<Navigate to="/dashboard" replace/>}/>
 </Routes></Suspense>;
}
export default function App(){return <BrowserRouter><AuthProvider><Router/></AuthProvider></BrowserRouter>;}
