import {assert} from './errors.js';
import {validateShape} from './agents.js';

export function citationRequest(input,baseSchema) {
  const catalog=[];
  for(const doc of input.documents)for(const page of doc.pages) {
    const offset=input.part?.segments.find(segment=>segment.document_id===doc.id && segment.page===page.page)?.start || 0;
    let start=0;
    while(start<page.text.length) {
      let end=Math.min(start+650,page.text.length);
      if(end<page.text.length){const boundary=page.text.lastIndexOf(' ',end);if(boundary>start+400)end=boundary;}
      if(end<page.text.length && /[\uD800-\uDBFF]/.test(page.text[end-1]))end--;
      const quote=page.text.slice(start,end);
      if(quote.trim())catalog.push({source_id:`S${String(catalog.length+1).padStart(4,'0')}`,document_id:doc.id,page:page.page,start:offset+start,end:offset+end,quote});
      start=end;
    }
  }
  const schema=structuredClone(baseSchema),reference={type:'object',properties:{source_id:{type:'string',...(catalog.length && catalog.length<=128 ? {enum:catalog.map(source=>source.source_id)} : {})}},required:['source_id'],additionalProperties:false};
  schema.properties.requirements.items.properties.sources={type:'array',items:reference,minItems:1,maxItems:10};
  schema.properties.alerts.items.properties.sources={type:'array',items:reference,minItems:0,maxItems:10};
  return {input:{...input,source_catalog:catalog},schema};
}

export function resolveCitations(output,input,schema) {
  validateShape(output,schema);
  const resolve=items=>items.map(item=>({...item,sources:item.sources.map(reference=>{
    const source=input.source_catalog.find(source=>source.source_id===reference.source_id);
    assert(source,'Identificador de fonte não existe na entrada preservada.',422);
    return {document_id:source.document_id,page:source.page,quote:source.quote};
  })}));
  return {...output,requirements:resolve(output.requirements),alerts:resolve(output.alerts)};
}

export const preservedOutput=artifact=>artifact.validated_output || JSON.parse(artifact.raw);
