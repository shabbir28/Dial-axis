import axios from 'axios';
const api=axios.create({baseURL:'/api',withCredentials:true,timeout:20000});
api.interceptors.response.use(r=>r,error=>{
 if(error.response?.status===401 && !error.config?.url?.includes('/auth/login') && window.location.pathname!=='/login') window.location.assign('/login');
 return Promise.reject(error);
});
export default api;
