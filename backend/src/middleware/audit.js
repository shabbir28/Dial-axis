const db=require('../config/db');
// Persist intent before the action. Do not record request bodies, cookies, phones or CSV bytes.
module.exports=function audit(action,context=()=>({})){
 return async(req,res,next)=>{
  const info=context(req);
  let event;
  try{
   event=(await db.query('INSERT INTO audit_logs(actor_id,username,actor_role,action,dialer_id,ip_address,details) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [req.user.id,req.user.username,req.user.role,action,info.dialer_id||null,String(req.ip||'').slice(0,80),JSON.stringify(info.details||{})])).rows[0];
  }catch{return res.status(503).json({message:'Could not record this action. Please retry.'});}
  const send=res.json.bind(res);
  let sending=false;
  res.json=body=>{
   if(sending)return res;
   sending=true;
   const status=res.statusCode;
   const outcome=status>=400?'failed':action==='download'?'prepared':action==='scan'?'requested':'completed';
   // Explicit allowlist only. The response may contain entire CSV files or password hashes.
   const details={...(info.details||{}),...(res.locals.audit||{})};
   if(action==='download'&&status<400&&typeof body?.fileName==='string')details.file_name=body.fileName.slice(0,200);
   if(action==='scan'&&status<400)details.job_status=body?.status;
   db.query('UPDATE audit_logs SET outcome=$1,http_status=$2,completed_at=now(),details=$3 WHERE id=$4',
    [outcome,status,JSON.stringify(details),event.id]).then(()=>{
     if(!res.destroyed)send(body);
    }).catch(()=>{
     // Never release download contents if final audit persistence failed.
     if(!res.destroyed){res.statusCode=503;send({message:'Audit recording unavailable. Please retry.'});}
    });
   return res;
  };
  next();
 };
};
