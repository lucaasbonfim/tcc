import {useEffect,useState} from 'react';
import {research} from '../services/research.service';
const terminal=status=>['completed','failed','cancelled'].includes(status);
export function useResearchTimeline(runId,revision,onSettled) {
  const [state,setState]=useState({runId:null,events:[],summary:null,connection:'Carregando',error:''});
  useEffect(()=>{
    const controller=new AbortController();let source=null,stopped=false;
    const update=patch=>{if(!stopped)setState(previous=>({...previous,...patch}));};
    async function load(){try{let page,after='0';const events=[];
      do{page=await research.get(`/runs/${runId}/events?after=${after}&limit=200`,{signal:controller.signal});events.push(...page.events);after=page.cursor;}while(page.has_more && !stopped);
      if(stopped)return;update({runId,events,summary:page.summary,failure:page.failure,history_mode:page.history_mode,status:page.status,error:'',connection:page.history_mode==='legacy'?'Histórico legado':terminal(page.status)?'Histórico preservado':'Conectando'});
      if(page.history_mode==='legacy'||terminal(page.status))return;
      source=research.events(runId,after);
      source.onopen=()=>update({connection:'Ao vivo',error:''});
      source.addEventListener('run_event',message=>{const event=JSON.parse(message.data);if(stopped)return;setState(previous=>previous.runId!==runId||previous.events.some(e=>e.id===event.id)?previous:{...previous,events:[...previous.events,event]});});
      source.addEventListener('state',message=>{const data=JSON.parse(message.data);update({summary:data.summary,status:data.status,failure:data.failure});if(data.status!==page.status){page.status=data.status;onSettled();}});
      source.addEventListener('settled',()=>{source.close();update({connection:'Histórico preservado'});onSettled();});
      source.addEventListener('stream_error',()=>{source.close();update({connection:'Conexão interrompida',error:'Atualize o histórico para retomar do registro preservado.'});});
      source.onerror=()=>update({connection:'Reconectando',error:'Aguardando reconexão ao último evento recebido.'});
    }catch(error){if(!controller.signal.aborted)update({runId,error:error.message,connection:'Indisponível'});}}
    load();return()=>{stopped=true;controller.abort();source?.close();};
  },[runId,revision,onSettled]);
  return state.runId===runId?state:{events:[],summary:null,connection:'Carregando',error:''};
}
