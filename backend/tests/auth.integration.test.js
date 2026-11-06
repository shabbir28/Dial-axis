const test=require('node:test');
const assert=require('node:assert/strict');
const bcrypt=require('bcryptjs');
test('login, first-password gate, role boundaries, origins and session revocation',async()=>{
 const realDb=require('../src/config/db');
 const client=await realDb.getClient();
 await client.query('BEGIN');
 const dbPath=require.resolve('../src/config/db');
 require.cache[dbPath].exports={query:(sql,args)=>client.query(sql,args),getClient:async()=>({
 query:(sql,args)=>client.query(sql==='BEGIN'?'SAVEPOINT route_test':sql==='COMMIT'?'RELEASE SAVEPOINT route_test':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT route_test':sql,args),release(){}
 })};
 let server;
 try{
  const suffix=Date.now();
  const password='Test123!';
  const hash=await bcrypt.hash(password,12);
  const users={};
  for(const role of ['user','admin']){
   const r=await client.query('INSERT INTO app_users(username,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,false) RETURNING id,username',[role+'_'+suffix,'Test account',hash,role]);users[role]=r.rows[0];
  }
  const app=require('../src/app');
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(url,{cookie,method='GET',body,origin}={})=>fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{}),...(origin?{origin}:{})},body:body?JSON.stringify(body):undefined});
  assert.equal((await call('/dialer/sources')).status,401);
  assert.equal((await call('/auth/login',{method:'POST',body:{username:users.user.username,password:'wrong'}})).status,401);
  const cookies={};
  for(const role of Object.keys(users)){
   const r=await call('/auth/login',{method:'POST',body:{username:users[role].username,password}});
   assert.equal(r.status,200);
   assert.match(r.headers.get('set-cookie'),/HttpOnly/i);
   assert.match(r.headers.get('set-cookie'),/SameSite=Strict/i);
   cookies[role]=r.headers.get('set-cookie').split(';')[0];
   const sources=await call('/dialer/sources',{cookie:cookies[role]});
   assert.deepEqual((await sources.json()).map(x=>x.id),['t6','fe','fe2']);
  }
  assert.equal((await call('/users',{cookie:cookies.user})).status,403);
  assert.equal((await call('/dialer/sources/fe/duplicates/scan',{cookie:cookies.user,method:'POST'})).status,403);
  assert.equal((await call('/users',{cookie:cookies.admin,method:'POST',body:{username:'denied_'+suffix,display_name:'Denied',password,role:'super_admin'}})).status,400);
  assert.equal((await call('/users/'+users.admin.id,{cookie:cookies.admin,method:'PATCH',body:{role:'user',active:false}})).status,400);
  assert.equal((await call('/users',{cookie:cookies.admin,method:'POST',origin:'https://untrusted.invalid',body:{}})).status,403);
  assert.equal((await call('/users',{cookie:cookies.admin,method:'POST',body:{username:'short_'+suffix,display_name:'Short',password:'1234567',role:'user'}})).status,400);
  assert.equal((await call('/users',{cookie:cookies.admin,method:'POST',body:{username:'admin_new_'+suffix,display_name:'Another admin',password,role:'admin'}})).status,201);
  const created=await call('/users',{cookie:cookies.admin,method:'POST',body:{username:'new_'+suffix,display_name:'New user',password,role:'user'}});
  assert.equal(created.status,201);
  const newAccount=await created.json();
  let r=await call('/auth/login',{method:'POST',body:{username:newAccount.username,password}});
  const initial=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/dialer/sources',{cookie:initial})).status,403);
  assert.equal((await call('/auth/password',{cookie:initial,method:'POST',body:{currentPassword:password,password:'1234567'}})).status,400);
  r=await call('/auth/password',{cookie:initial,method:'POST',body:{currentPassword:password,password:'Next123!'}});
  assert.equal(r.status,200);
  const changed=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/auth/me',{cookie:initial})).status,401);
  assert.equal((await call('/dialer/sources',{cookie:changed})).status,200);
  assert.equal((await call('/users/'+users.user.id,{cookie:cookies.admin,method:'PATCH',body:{role:'user',active:false}})).status,200);
  assert.equal((await call('/auth/me',{cookie:cookies.user})).status,401);
  assert.equal((await call('/auth/logout',{cookie:changed,method:'POST'})).status,200);
  assert.equal((await call('/auth/me',{cookie:changed})).status,401);
  const auditRows=(await client.query('SELECT action,outcome,details FROM audit_logs WHERE actor_id=$1',[users.admin.id])).rows;
  assert.ok(auditRows.some(e=>e.action==='user.create'&&e.outcome==='completed'));
  assert.ok(auditRows.some(e=>e.action==='user.update'&&e.outcome==='completed'&&e.details.active===false));
  assert.ok(!JSON.stringify(auditRows).includes(password));

 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await client.query('ROLLBACK');
  client.release();
  require.cache[dbPath].exports=realDb;
  await realDb.close();
 }
});
