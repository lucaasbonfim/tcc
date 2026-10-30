import { createHash } from 'node:crypto';
export function repositoryFixture(files) {
  const blobs=new Map();
  const tree=Object.entries(files).map(([path,content])=>{
    const data=Buffer.from(content);
    const sha=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
    blobs.set(sha,{encoding:'base64',content:data.toString('base64')});
    return {path,sha,type:'blob',mode:'100644',size:data.length};
  });
  const requests=[];
  return {requests,fetch:async (url,options)=>{
    requests.push({url,options});
    if(url.includes('/git/trees/'))return new Response(JSON.stringify({tree,truncated:false}));
    const blob=blobs.get(url.split('/').pop());
    return blob ? new Response(JSON.stringify(blob)) : new Response('',{status:404});
  }};
}
