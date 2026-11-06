import {createContext,useContext,useEffect,useState} from 'react';
import api from '../services/api';
const AuthContext=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{setUser((await api.get('/auth/me')).data);}catch(e){if(e.response?.status!==401)setError('Cannot connect to the server.');}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function login(username,password){const r=await api.post('/auth/login',{username,password});setUser(r.data);return r.data;}
 async function logout(){await api.post('/auth/logout');setUser(null);}
 return <AuthContext.Provider value={{user,setUser,loading,error,retry:load,login,logout}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
