import {assert} from './errors.js';
import {sha256,validateBundle,validateExecutionResult} from '../../../shared/execution-protocol.js';

export function createExecutorClient(config={url:process.env.EXECUTOR_URL,token:process.env.EXECUTOR_TOKEN,deployment:process.env.EXECUTOR_DEPLOYMENT_ID,policy:process.env.EXECUTOR_POLICY_SHA256,mode:process.env.EXECUTOR_MODE},fetchImpl=fetch) {
  const mode=config.mode || 'dedicated-vm',development=mode==='docker-desktop-dev';
  const configured=Boolean(config.url && config.token?.length>=32 && config.deployment && /^[a-f0-9]{64}$/.test(config.policy || ''));
  async function request(path,{method='GET',body,signal}={}) {
    assert(configured,'Executor dedicado não configurado.',503);
    const url=new URL(config.url);
    assert(['dedicated-vm','docker-desktop-dev'].includes(mode),'Perfil do executor desconhecido.',503);
    const loopback=['127.0.0.1','[::1]'].includes(url.hostname);
    assert(!development || (process.env.NODE_ENV!=='production' && loopback),'Modo local exige loopback e ambiente de desenvolvimento.',503);
    assert((url.protocol==='https:' || (development && loopback && url.protocol==='http:')) && !url.username && !url.password && !url.search && !url.hash,'Executor exige HTTPS; HTTP somente em modo local explícito e loopback.',503);
    const timeout=AbortSignal.timeout(8000);
    const controller=new AbortController();
    const abort=()=>controller.abort();timeout.addEventListener('abort',abort,{once:true});signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)controller.abort();
    try {
      const response=await fetchImpl(new URL(path,url),{method,redirect:'error',signal:controller.signal,
        headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:body ? JSON.stringify(body) : undefined});
      assert(response.ok,`Executor indisponível (HTTP ${response.status}).`,503);
      const chunks=[];let bytes=0;
      for await(const chunk of response.body){bytes+=chunk.length;assert(bytes<=2097152,'Resposta do executor excede limite.',502);chunks.push(Buffer.from(chunk));}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }finally{timeout.removeEventListener('abort',abort);signal?.removeEventListener('abort',abort);}
  }
  const client={
    async health() {
      if(!configured)return {ready:false,reason:'Executor não configurado. Use npm run dev:local para Docker Desktop ou configure o serviço dedicado.'};
      try {
        const receipt=await request('/v1/health');
        assert(receipt.ready===true && receipt.protocol_version===1 && receipt.deployment_id===config.deployment && receipt.policy_sha256===config.policy,'Recibo do executor não corresponde à política autorizada.',503);
        assert((receipt.isolation_profile || 'dedicated-vm')===mode && Boolean(receipt.development_only)===development,'Perfil do executor diverge da configuração.',503);
        const age=Date.now()-Date.parse(receipt.validated_at);
        assert(Number.isFinite(age) && age>=-300000 && age<3600000,'Validação do executor expirada.',503);
        assert(receipt.limits?.network==='none' && receipt.limits.cpu===1 && receipt.limits.memory_bytes===268435456 && receipt.limits.pids===64 && receipt.limits.timeout_ms<=60000,'Limites do executor divergentes.',503);
        assert(receipt.images && Object.keys(receipt.images).length>0 && Object.values(receipt.images).every(image=>/^sha256:[a-f0-9]{64}$/.test(image.image_id)),'Imagens imutáveis ausentes.',503);
        return receipt;
      }catch{return {ready:false,reason:'Executor não acessível ou isolamento/política/imagens não validados. Confira serviço e perfil configurados.'};}
    },
    async cancel(jobId){return request(`/v1/jobs/${jobId}`,{method:'DELETE'});},
    async execute(bundle,receipt,{signal}={}) {
      validateBundle(bundle);
      const current=await client.health();
      assert(current.ready && current.policy_sha256===receipt.policy_sha256 && current.images[bundle.adapter]?.image_id===receipt.images[bundle.adapter]?.image_id,'Configuração do executor mudou ou está indisponível. Autorize uma nova execução.',503);
      const requestHash=sha256(bundle);
      await request('/v1/jobs',{method:'POST',body:{bundle,request_sha256:requestHash},signal});
      const deadline=Date.now()+80000;
      try {
        while(Date.now()<deadline) {
          assert(!signal?.aborted,'Execução cancelada.',409);
          const record=await request(`/v1/jobs/${bundle.job_id}`,{signal});
          if(record.status==='finished') {
            validateExecutionResult(record.result,bundle,requestHash);
            assert(record.result.environment.image_id===receipt.images[bundle.adapter].image_id && record.result.environment.deployment_id===receipt.deployment_id && record.result.environment.policy_sha256===receipt.policy_sha256,'Ambiente da evidência diverge da autorização.',502);
            assert((record.result.environment.isolation_profile || 'dedicated-vm')===mode && Boolean(record.result.environment.development_only)===development,'Perfil da evidência diverge da autorização.',502);
            return record.result;
          }
          await new Promise(resolve=>{const timer=setTimeout(done,1000);function done(){clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();}signal?.addEventListener('abort',done,{once:true});});
        }
        assert(false,'Executor não retornou no prazo.',503);
      }catch(error){await client.cancel(bundle.job_id).catch(()=>{});throw error;}
    },
  };
  return client;
}
