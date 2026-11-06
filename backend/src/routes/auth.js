const router=require('express').Router();
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {rateLimit}=require('express-rate-limit');
const db=require('../config/db');
const auth=require('../middleware/auth');
const cookieOptions={httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:8*60*60*1000};
const safe=user=>({id:user.id,username:user.username,display_name:user.display_name,role:user.role,must_change_password:user.must_change_password});
function session(res,user){res.cookie('dr_session',jwt.sign({id:user.id,version:user.token_version},process.env.JWT_SECRET,{expiresIn:'8h',algorithm:'HS256'}),cookieOptions);}
const limiter=rateLimit({windowMs:15*60*1000,limit:15,skipSuccessfulRequests:true,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many login attempts. Try again in 15 minutes.'}});
router.post('/login',limiter,async(req,res)=>{
 const {username,password}=req.body||{};
 if(typeof username!=='string'||typeof password!=='string'||password.length>128) return res.status(400).json({message:'Enter your username and password.'});
 const {rows}=await db.query('SELECT * FROM app_users WHERE username=$1',[username.trim().toLowerCase()]);
 const user=rows[0];
 const hash=user?.password_hash||'$2b$12$C6UzMDM.H6dfI/f/IKcEe.4dLq7QqmR1QFRRafQqA2E/cYlWsLRWu';
 const valid=await bcrypt.compare(password,hash);
 if(!user?.active||!valid)return res.status(401).json({message:'Invalid username or password.'});
 session(res,user);res.json(safe(user));
});
router.get('/me',auth,(req,res)=>res.json(safe(req.user)));
router.post('/logout',auth,async(req,res)=>{
 await db.query('UPDATE app_users SET token_version=token_version+1 WHERE id=$1',[req.user.id]);
 res.clearCookie('dr_session',{...cookieOptions,maxAge:undefined});res.json({ok:true});
});
router.post('/password',auth,limiter,async(req,res)=>{
 const {currentPassword,password}=req.body||{};
 if(typeof password!=='string'||password.length<8||password.length>128||typeof currentPassword!=='string'||currentPassword.length>128)return res.status(400).json({message:'New password must contain 8–128 characters.'});
 const {rows}=await db.query('SELECT password_hash FROM app_users WHERE id=$1',[req.user.id]);
 if(!await bcrypt.compare(currentPassword,rows[0].password_hash))return res.status(400).json({message:'Current password is incorrect.'});
 if(password===currentPassword)return res.status(400).json({message:'Choose a different password.'});
 const hash=await bcrypt.hash(password,12);
 const updated=await db.query('UPDATE app_users SET password_hash=$1,must_change_password=false,token_version=token_version+1 WHERE id=$2 AND password_hash=$3 RETURNING *',[hash,req.user.id,rows[0].password_hash]);
 if(!updated.rows[0])return res.status(409).json({message:'Password changed elsewhere. Sign in again.'});
 session(res,updated.rows[0]);res.json(safe(updated.rows[0]));
});
module.exports=router;
