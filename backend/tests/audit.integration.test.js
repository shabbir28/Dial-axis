const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {randomUUID}=require('node:crypto');
test('audit records every export without payloads, enforces Admin access and fails closed',async()=>{
 const realDb=require('../src/config/db'),client=await realDb.getClient();
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'dialer-audit-'));
 await client.query('BEGIN');
 let server,failUpdate=false,failInsert=false;
 const dbPath=require.resolve('../src/config/db');
 require.cache[dbPath].exports={query:(sql,args)=>{
  if(failUpdate&&sql.startsWith('UPDATE audit_logs'))return Promise.reject(new Error('test audit outage'));
  if(failInsert&&sql.startsWith('INSERT INTO audit_logs'))return Promise.reject(new Error('test audit outage'));
  return client.query(sql,args);
 }};
 try{
  const id=randomUUID();
  const result={export_id:id,export_version:3,unique_numbers:1,duplicate_entries:1,total_records:2,missing_numbers:0,total_lists:1,scanned_at:new Date().toISOString(),occurrence_counts:{zero_to_four:1,five_or_more:0,dnc:1,unknown:0}};
  const header='phone_number,occurrence_count,status,call_count,list_id,lead_id\n';
  await fs.writeFile(path.join(directory,id+'-unique.csv'),header+'2025550101,2,A,1,1,10\n');
  await fs.writeFile(path.join(directory,id+'-duplicates.csv'),header+'2025550101,2,DNC,3,1,11\n');
  const sourcePath=require.resolve('../src/utils/dialerSources');const original=require(sourcePath);
  require.cache[sourcePath].exports={sources:Object.fromEntries(Object.entries(original.sources).map(([key,value])=>[key,{...value,directory}]))};
  const jobPath=require.resolve('../src/utils/dialerDuplicateJob');require(jobPath);
  require.cache[jobPath].exports={createDuplicateJob:()=>({status:()=>({status:'complete',result}),start:()=>({status:'running'})})};
  const users={};
  for(const role of ['user','admin']){
   const r=await client.query('INSERT INTO app_users(username,display_name,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,false) RETURNING id,username',[role+'_'+id.slice(0,8),'Audit Test','not-used',role]);users[role]=r.rows[0];
  }
  const jwt=require('jsonwebtoken'),cookies={};
  for(const role of ['user','admin'])cookies[role]='dr_session='+jwt.sign({id:users[role].id,version:0},process.env.JWT_SECRET,{expiresIn:'5m'});
  server=require('../src/app').listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=(url,role='user',body)=>fetch(base+url,{method:body?'POST':'GET',headers:{cookie:cookies[role],...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  for(const [kind,count]of [['unique',1],['duplicates',1],['under5',1],['over5',0],['dnc',1]]){
   const r=await call('/dialer/sources/fe/duplicates/'+kind+'/download');
   assert.equal(r.status,200);assert.ok((await r.json()).csv.startsWith('phone_number,call_count,status,lead_call_attempts'));
   const event=(await client.query("SELECT * FROM audit_logs WHERE actor_id=$1 ORDER BY id DESC LIMIT 1",[users.user.id])).rows[0];
   assert.equal(event.action,'download');assert.equal(event.outcome,'prepared');assert.equal(event.dialer_id,'fe');assert.equal(event.details.rows,count);assert.equal(event.details.kind,kind);
   assert.ok(!JSON.stringify(event).includes('2025550101'));assert.ok(!JSON.stringify(event).includes('dr_session'));
  }
  const selected=await call('/dialer/sources/t6/duplicates/unique/statuses/download','user',{statuses:['A'],export_id:id});
  assert.equal(selected.status,200);
  const selectedEvent=(await client.query('SELECT * FROM audit_logs WHERE actor_id=$1 ORDER BY id DESC LIMIT 1',[users.user.id])).rows[0];
  assert.deepEqual(selectedEvent.details.statuses,['A']);assert.equal(selectedEvent.details.rows,1);assert.equal(selectedEvent.dialer_id,'t6');
  assert.equal((await call('/dialer/sources/fe/duplicates/unique/statuses/download','user',{statuses:['A'],export_id:'old'})).status,409);
  assert.equal((await call('/dialer/sources/fe/duplicates/scan','user',{})).status,403);
  assert.equal((await call('/audit')).status,403);
  const audit=await call('/audit?action=download&q='+users.user.username,'admin');assert.equal(audit.status,200);
  const page=await audit.json();assert.equal(page.summary.total,7);assert.equal(page.summary.downloads,6);assert.equal(page.summary.failed,1);
  assert.equal((await call('/audit?action=bad','admin')).status,400);
  failUpdate=true;
  const blocked=await call('/dialer/sources/fe/duplicates/unique/download');assert.equal(blocked.status,503);assert.equal((await blocked.json()).csv,undefined);
  failUpdate=false;failInsert=true;
  assert.equal((await call('/dialer/sources/fe/duplicates/unique/download')).status,503);
 }finally{
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  await client.query('ROLLBACK');client.release();require.cache[dbPath].exports=realDb;await realDb.close();
  await fs.rm(directory,{recursive:true,force:true});
 }
});
