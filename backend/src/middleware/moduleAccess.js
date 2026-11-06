module.exports=()=> (req,res,next)=>{
 if(!['user','admin'].includes(req.user?.role)) return res.status(403).json({message:'Access denied.'});
 if(req.user.must_change_password) return res.status(403).json({message:'Change your initial password first.'});
 if(req.method==='POST'&&req.path.endsWith('/scan')&&req.user.role==='user') return res.status(403).json({message:'Only admins can start a number scan.'});
 next();
};
