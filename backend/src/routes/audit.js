const router=require('express').Router();
const db=require('../config/db');
router.use(require('../middleware/auth'),require('../middleware/moduleAccess')());
router.use((req,res,next)=>req.user.role==='admin'?next():res.status(403).json({message:'Admin access required.'}));
router.get('/',async(req,res)=>{
 const page=Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1));
 const limit=25;
 const clauses=[],params=[];
 const add=(sql,value)=>{params.push(value);clauses.push(sql.replace('?', '$'+params.length));};
 if(req.query.q){if(typeof req.query.q!=='string'||req.query.q.length>64)return res.status(400).json({message:'Invalid user search.'});add("username ILIKE ? ESCAPE '\\'",'%'+req.query.q.replace(/[\\%_]/g,'\\$&')+'%');}
 if(req.query.action){if(!['download','scan','user.create','user.update'].includes(req.query.action))return res.status(400).json({message:'Invalid action filter.'});add('action=?',req.query.action);}
 if(req.query.dialer){if(!Object.hasOwn(require('../utils/dialerSources').sources,req.query.dialer))return res.status(400).json({message:'Invalid dialer filter.'});add('dialer_id=?',req.query.dialer);}
 if(req.query.outcome){if(!['prepared','requested','completed','failed','pending'].includes(req.query.outcome))return res.status(400).json({message:'Invalid outcome filter.'});add('outcome=?',req.query.outcome);}
 for(const [key,operator]of [['from','>='],['to','<']]){
  if(req.query[key]){const date=new Date(req.query[key]);if(!Number.isFinite(date.getTime()))return res.status(400).json({message:'Invalid date filter.'});add('created_at '+operator+' ?',date.toISOString());}
 }
 const where=clauses.length?'WHERE '+clauses.join(' AND '):'';
 const summary=(await db.query("SELECT count(*)::int AS total,count(*) FILTER(WHERE action='download' AND outcome='prepared')::int AS downloads,count(*) FILTER(WHERE outcome='failed')::int AS failed FROM audit_logs "+where,params)).rows[0];
 const rows=(await db.query('SELECT * FROM audit_logs '+where+' ORDER BY created_at DESC,id DESC LIMIT $'+(params.length+1)+' OFFSET $'+(params.length+2),[...params,limit,(page-1)*limit])).rows;
 res.json({rows,summary,page,limit,totalPages:Math.max(1,Math.ceil(summary.total/limit))});
});
module.exports=router;
