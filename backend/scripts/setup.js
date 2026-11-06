const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const bcrypt=require('bcryptjs');
const db=require('../src/config/db');
(async()=>{
 const client=await db.getClient();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(194405101)');
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/001_auth.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/002_two_roles.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(__dirname,'../migrations/003_audit_logs.sql'),'utf8'));
  const existing=await client.query('SELECT id FROM app_users LIMIT 1');
  if(!existing.rowCount){
   const password=crypto.randomBytes(18).toString('base64url');
   const hash=await bcrypt.hash(password,12);
   await client.query("INSERT INTO app_users(username,display_name,password_hash,role) VALUES('admin','Admin',$1,'admin')",[hash]);
   fs.writeFileSync(path.join(__dirname,'../../setup-credentials.txt'),'DialAxis — initial login\nURL: http://localhost:5100\nUsername: admin\nPassword: '+password+'\n\nPassword change required on first login. Delete this file after signing in.\n',{flag:'wx',mode:0o600});
   console.log('Initial login saved to setup-credentials.txt. Password change required.');
  }
  await client.query('COMMIT');
  console.log('dialer_record schema ready.');
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
})().catch(e=>{console.error('Setup failed:',e.message);process.exitCode=1;}).finally(()=>db.close());
