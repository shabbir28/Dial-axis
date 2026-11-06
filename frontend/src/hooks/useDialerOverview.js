import {useCallback,useEffect,useRef,useState} from 'react';
import api from '../services/api';
export default function useDialerOverview(){
 const [entries,setEntries]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const running=useRef(null);
 const refresh=useCallback(async(force=false)=>{
  if(running.current)return;
  const controller=new AbortController();running.current=controller;setLoading(true);setError('');
  try{
   const sources=(await api.get('/dialer/sources',{signal:controller.signal})).data;
   const results=await Promise.allSettled(sources.map(s=>api.get('/dialer/sources/'+s.id+'/lists',{signal:controller.signal,timeout:75000,params:force?{refresh:'1'}:undefined})));
   if(!controller.signal.aborted)setEntries(previous=>sources.map((source,index)=>{
    const result=results[index];
    return {...source,data:result.status==='fulfilled'?result.value.data:previous.find(p=>p.id===source.id)?.data,error:result.status==='rejected'?'Could not refresh this dialer.':null};
   }));
  }catch(e){if(!controller.signal.aborted)setError(e.response?.data?.message||'Could not load the dashboard.');}
  finally{if(running.current===controller)running.current=null;if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{
  refresh();const timer=setInterval(()=>{if(!document.hidden)refresh(true);},120000);
  const visible=()=>{if(!document.hidden)refresh();};
  document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);running.current?.abort();running.current=null;};
 },[refresh]);
 return {entries,loading,error,refresh};
}
