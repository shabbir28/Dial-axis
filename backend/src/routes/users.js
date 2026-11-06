const router=require('express').Router();
const db=require('../config/db');
const bcrypt=require('bcryptjs');
router.use(require('../middleware/auth'));
const audit=require('../middleware/audit');
router.use((req,res,next)=>{
 if(!['POST','PATCH'].includes(req.method))return next();
 return audit(req.method==='POST'?'user.create':'user.update',()=>({details:{target_id:/^\/\d+$/.test(req.path)?req.path.slice(1):null}}))(req,res,next);
});
router.use(require('../middleware/moduleAccess')());
router.use((req,res,next)=>req.user.role!=='admin'?res.status(403).json({message:'Admin access required.'}):next());
const publicColumns='id,username,display_name,role,active,must_change_password,created_at';
router.get('/',async(req,res)=>{
 const {rows}=await db.query('SELECT '+publicColumns+' FROM app_users '+''+'ORDER BY created_at DESC');
 res.json(rows);
});
router.post('/',async(req,res)=>{
 const {username,display_name,password,role}=req.body||{};
 if(typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)||typeof display_name!=='string'||!display_name.trim()||display_name.length>100||typeof password!=='string'||password.length<8||password.length>128||!['user','admin'].includes(role))return res.status(400).json({message:'Enter a valid username, name, role and password (8–128 characters).'});

 try{
 const hash=await bcrypt.hash(password,12);
 const {rows}=await db.query('INSERT INTO app_users(username,display_name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING '+publicColumns,[username.toLowerCase(),display_name.trim(),hash,role]);
 res.locals.audit={target_id:rows[0].id,target_username:rows[0].username,role:rows[0].role};
 res.status(201).json(rows[0]);
 }catch(e){if(e.code==='23505')return res.status(409).json({message:'Username already exists.'});throw e;}
});
router.patch('/:id',async(req,res)=>{
 const {role,active}=req.body||{};
 if(!/^\d+$/.test(req.params.id)||!['user','admin'].includes(role)||typeof active!=='boolean')return res.status(400).json({message:'Invalid account update.'});
 if(Number(req.params.id)===req.user.id)return res.status(400).json({message:'You cannot change your own role or active status.'});


 const client=await db.getClient();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(194405102)');
  const actor=(await client.query('SELECT role,active,token_version FROM app_users WHERE id=$1',[req.user.id])).rows[0];
  if(!actor?.active||actor.role!=='admin'||actor.token_version!==req.user.token_version){
   await client.query('ROLLBACK');return res.status(403).json({message:'Admin access changed. Sign in again.'});
  }
  const target=(await client.query('SELECT role,active FROM app_users WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
  if(!target){await client.query('ROLLBACK');return res.status(404).json({message:'User not found.'});}
  if(target.role==='admin'&&target.active&&(role!=='admin'||!active)){
   const count=await client.query("SELECT count(*)::int AS count FROM app_users WHERE role='admin' AND active");
   if(count.rows[0].count<=1){await client.query('ROLLBACK');return res.status(400).json({message:'At least one active Admin is required.'});}
  }
  const result=await client.query('UPDATE app_users SET role=$1,active=$2,token_version=token_version+1 WHERE id=$3 RETURNING '+publicColumns,[role,active,req.params.id]);
  await client.query('COMMIT');res.locals.audit={target_id:result.rows[0].id,target_username:result.rows[0].username,previous_role:target.role,role,previous_active:target.active,active};res.json(result.rows[0]);
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}

});
module.exports=router;
