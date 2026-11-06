const jwt=require('jsonwebtoken');
const db=require('../config/db');
module.exports=async(req,res,next)=>{
 try {
  const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('dr_session='))?.slice(11);
  if(!token) return res.status(401).json({message:'Please sign in.'});
  const claim=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
  const {rows}=await db.query('SELECT id,username,display_name,role,active,must_change_password,token_version FROM app_users WHERE id=$1',[claim.id]);
  const user=rows[0];
  if(!user?.active||user.token_version!==claim.version) return res.status(401).json({message:'Session expired. Please sign in again.'});
  req.user=user;next();
 } catch(error) {
  if(error.name==='JsonWebTokenError'||error.name==='TokenExpiredError') return res.status(401).json({message:'Session expired.'});
  return res.status(503).json({message:'Account verification unavailable.'});
 }
};
