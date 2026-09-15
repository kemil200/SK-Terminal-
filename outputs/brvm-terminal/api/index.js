const {news,json}=require('../server.cjs');
const {feedRoute}=require('../feeds.cjs');
const {databaseHealth}=require('../database.cjs');
module.exports=async(req,res)=>{
  if(req.method!=='GET')return json(res,405,{message:'Méthode non autorisée.'});
  const url=new URL(req.url,'https://sk-terminal.local');
  if(url.pathname==='/api/index')url.pathname='/api/'+(url.searchParams.get('route')||'');
  url.searchParams.delete('route');
  try{
    if(url.pathname==='/api/news')return await news(req,res,url);
    if(url.pathname==='/api/database/health')return json(res,200,await databaseHealth());
    const result=await feedRoute(url);
    if(result)return json(res,result.status,result.body);
    return json(res,404,{message:'Route introuvable.'});
  }catch{return json(res,502,{message:'Service temporairement indisponible.'})}
};
