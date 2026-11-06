require('./env');
const {Pool}=require('pg');
const pool=new Pool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT)||5432,user:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD,database:process.env.DB_NAME,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:15000});
pool.on('error',()=>console.error('Database connection unavailable.'));
module.exports={query:(sql,args)=>pool.query(sql,args),getClient:()=>pool.connect(),close:()=>pool.end()};
