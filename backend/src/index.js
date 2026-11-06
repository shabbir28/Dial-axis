const app=require('./app');
const db=require('./config/db');
const port=Number(process.env.PORT)||5100;
db.query('SELECT id FROM app_users LIMIT 1').then(()=>{
 const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log('DialAxis ready at http://localhost:'+port));
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is already in use.':error.message);db.close();process.exitCode=1;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>db.close().then(()=>process.exit(0))));
}).catch(()=>{console.error('Database unavailable. Check backend/.env and run npm run setup.');db.close();process.exitCode=1;});
