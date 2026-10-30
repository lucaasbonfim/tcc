import {randomUUID} from 'node:crypto';
import {assert} from './errors.js';
import {requirementsOutputSchema,validateOutput,validateShape,validateRequirement,validateSources} from './agents.js';
import {canonical} from '../../../shared/execution-protocol.js';
import {preservedOutput} from './citations.js';

export const PART_SCHEMA={...requirementsOutputSchema,properties:{...requirementsOutputSchema.properties,requirements:{...requirementsOutputSchema.properties.requirements,minItems:0}}};
export function planParts(documents,{pageSlice=6000,budget=8000,overlap=600,maxPages=40}={}) {
  const fragments=[];
  for(const doc of documents)for(const page of doc.pages) {
    if(!page.text.length){fragments.push({document_id:doc.id,name:doc.name,version:doc.version,page:page.page,start:0,end:0,text:'',context_only:false});continue;}
    let start=0;
    while(start<page.text.length) {
      let end=Math.min(start+pageSlice,page.text.length);
      if(end<page.text.length) {
        const split=Math.max(page.text.lastIndexOf('\n',end),page.text.lastIndexOf(' ',end));
        if(split>start+pageSlice-1500)end=split;
        if(/[\uD800-\uDBFF]/.test(page.text[end-1]))end--;
      }
      fragments.push({document_id:doc.id,name:doc.name,version:doc.version,page:page.page,start,end,text:page.text.slice(start,end),context_only:false});
      if(end===page.text.length)break;start=Math.max(start+1,end-overlap);
    }
  }
  const groups=[];let current=[],size=0;
  for(const fragment of fragments) {
    if(current.length && (size+fragment.text.length>budget || current.length>=maxPages || current.some(f=>f.document_id===fragment.document_id && f.page===fragment.page))) {
      groups.push(current);current=[];size=0;
    }
    current.push(fragment);size+=fragment.text.length;
  }
  if(current.length)groups.push(current);
  assert(groups.length<=512,'Documento excede 512 partes. Reduza a seleção de documentos.',422);
  return groups.map((group,index)=>{
    const previous=groups[index-1]?.at(-1);
    const pieces=[...group];
    if(previous?.text && !group.some(f=>f.document_id===previous.document_id && f.page===previous.page)) {
      pieces.unshift({...previous,start:Math.max(previous.start,previous.end-overlap),text:previous.text.slice(-overlap),context_only:true});
    }
    const docs=new Map();
    for(const fragment of pieces) {
      if(!docs.has(fragment.document_id))docs.set(fragment.document_id,{id:fragment.document_id,name:fragment.name,version:fragment.version,pages:[]});
      docs.get(fragment.document_id).pages.push({page:fragment.page,text:fragment.text});
    }
    return {sequence:index+1,documents:[...docs.values()],segments:pieces.map(({text,...metadata})=>metadata),character_count:pieces.reduce((n,p)=>n+p.text.length,0)};
  });
}
export async function createParts(db,runId,documents,store) {
  const total=documents.reduce((n,d)=>n+d.pages.reduce((m,p)=>m+p.text.length,0),0);
  if(total<=24000 && documents.reduce((n,doc)=>n+doc.pages.length,0)<=40)return;
  const parts=planParts(documents);
  for(const part of parts) {
    const input=await store.put({documents:part.documents,part:{sequence:part.sequence,total:parts.length,segments:part.segments,
      limitations:['Trechos sobrepostos preservam fronteiras; referências distantes podem exigir revisão. Consolidação não supõe equivalência semântica.']}});
    await db.query(`INSERT INTO research.requirement_parts(id,run_id,sequence,status,input,segments,character_count)
      VALUES($1,$2,$3,'pending',$4,$5,$6)`,[randomUUID(),runId,part.sequence,input,JSON.stringify(part.segments),part.character_count]);
  }
}

export async function continuationParts(parts,store) {
  const prepared=[];
  for(const part of parts) {
    const input=await store.json(part.input);
    if(part.status==='completed') {
      validatePart(preservedOutput(await store.json(part.output)),input);
      prepared.push({status:'completed',input:part.input,output:part.output,segments:part.segments,character_count:part.character_count,attempt_count:part.attempt_count,reused_from_part_id:part.id});
      continue;
    }
    for(const plan of planParts(input.documents)) {
      const segments=plan.segments.map(segment=>{
        const original=(input.part?.segments || part.segments).find(s=>s.document_id===segment.document_id && s.page===segment.page);
        return {...segment,start:segment.start+(original?.start || 0),end:segment.end+(original?.start || 0),context_only:segment.context_only || Boolean(original?.context_only)};
      });
      prepared.push({status:'pending',input_data:{documents:plan.documents,part:{segments,limitations:['Continuação das partes não concluídas, redivididas em entradas menores.']}},segments,character_count:plan.character_count,attempt_count:0,reused_from_part_id:null});
    }
  }
  assert(prepared.length<=512,'Continuação excede 512 partes; reduza a seleção em uma nova análise.',422);
  return prepared.map((part,index)=>({...part,sequence:index+1,...(part.input_data ? {input_data:{...part.input_data,part:{...part.input_data.part,sequence:index+1,total:prepared.length}}} : {})}));
}
export function validatePart(output,input) {
  validateShape(output,PART_SCHEMA);
  if(output.requirements.length)validateOutput('requirements',output,input);
  else {
    assert(output.alerts.length>0,'Parte sem requisitos precisa de alerta justificando a ausência.',422);
    output.alerts.forEach(alert=>validateSources(alert.sources,input.documents));
  }
  return output;
}
const normalized=value=>value.toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
export function consolidateParts(parts) {
  const requirements=[],alerts=[],mapping=[],exact=new Map(),sameDescription=new Map();
  for(const part of parts) {
    for(const requirement of part.output.requirements) {
      const {code,sources,...body}=requirement;
      const signature=canonical(body);
      let record=exact.get(signature);
      if(record) {
        const combined=[...record.sources];
        for(const source of sources)if(!combined.some(s=>canonical(s)===canonical(source)))combined.push(source);
        if(combined.length<=10)record.sources=combined;else record=null;
      }
      if(!record) {
        record={...requirement,code:`RF-${String(requirements.length+1).padStart(4,'0')}`,sources:[...sources]};
        const key=normalized(requirement.description),prior=sameDescription.get(key);
        if(prior && prior.code!==record.code)alerts.push({kind:'ambiguity',description:`Possível duplicidade com conteúdo complementar distinto: ${prior.code} e ${record.code}. Revisão humana necessária.`,sources:record.sources});
        sameDescription.set(key,record);requirements.push(record);exact.set(signature,record);
      }
      mapping.push({part_id:part.id,local_code:code,consolidated_code:record.code});
    }
    alerts.push(...part.output.alerts);
  }
  const opposites=new Map();
  for(const requirement of requirements) {
    const description=normalized(requirement.description),withoutNegation=description.replace(/\bnão\s+/g,'');
    const prior=opposites.get(withoutNegation);
    if(prior && prior.description!==description)alerts.push({kind:'inconsistency',description:`Possível contradição textual entre ${prior.code} e ${requirement.code}; hipótese lexical, não conclusão automática.`,sources:requirement.sources});
    opposites.set(withoutNegation,{code:requirement.code,description});
  }
  assert(requirements.length>0 && requirements.length<=2000,'Consolidação sem requisitos ou excedendo 2000 itens; revise a seleção.',422);
  return {output:{requirements,alerts},mapping,method:'deterministic-exact-content/v1',limitations:['Somente conteúdo idêntico é mesclado. Diferenças semânticas/contradições distantes exigem revisão humana.']};
}
