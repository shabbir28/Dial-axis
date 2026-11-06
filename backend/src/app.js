require('./config/env');
const express=require('express');
const helmet=require('helmet');
const path=require('node:path');
const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({limit:'32kb'}));
app.use('/api',(req,res,next)=>{
 res.set('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
  const origin=req.headers.origin;
  const allowed=new Set((process.env.APP_ORIGINS||'http://localhost:5100,http://127.0.0.1:5100,http://localhost:5175,http://127.0.0.1:5175').split(','));
  if(req.headers['sec-fetch-site']==='cross-site'||(origin&&!allowed.has(origin)))return res.status(403).json({message:'Request origin not allowed.'});
 }
 next();
});
app.get('/api/health',async(req,res)=>{await require('./config/db').query('SELECT 1');res.json({status:'ok'});});
app.use('/api/auth',require('./routes/auth'));
app.use('/api/audit',require('./routes/audit'));
app.use('/api/users',require('./routes/users'));
app.use('/api/dialer',require('./routes/dialer'));
app.use('/api',(req,res)=>res.status(404).json({message:'API route not found.'}));
app.use(express.static(path.join(__dirname,'../../frontend/dist')));
app.get('/{*path}',(req,res)=>res.sendFile(path.join(__dirname,'../../frontend/dist/index.html')));
app.use((err,req,res,next)=>{
 if(res.headersSent)return next(err);
 console.error('Request failed:',err.code||err.name);
 res.status(err.status===400?400:500).json({message:err.status===400?'Invalid request.':'Request could not be completed. Please retry.'});
});
module.exports=app;
