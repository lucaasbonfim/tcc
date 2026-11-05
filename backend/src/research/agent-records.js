import {assert} from './errors.js';

// Coverage means complete delivery, not correct interpretation by the model.
export function createRecordReader({records,maxObservationChars=12000,idField='id'}) {
  const texts=new Map(records.map(({id,data})=>[id,JSON.stringify(data)])),ranges=new Map();
  const complete=id=>ranges.get(id)?.length===1 && ranges.get(id)[0][0]===0 && ranges.get(id)[0][1]===texts.get(id).length;
  function add(id,start,end){const merged=[];for(const span of [...(ranges.get(id) || []),[start,end]].sort((a,b)=>a[0]-b[0])){const last=merged.at(-1);if(last && span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push([...span]);}ranges.set(id,merged);}
  return {
    complete,characters:id=>texts.get(id)?.length,
    assertComplete(){assert([...texts.keys()].every(complete),'Consulte integralmente todos os registros atribuídos.',422);},
    read(id,offset,length) {
      const text=texts.get(id);assert(text!==undefined,'Registro fora da tarefa.',403);assert(offset<text.length,'Offset excede o registro.',422);
      const make=end=>({[idField]:id,format:'json',offset,end,total_characters:text.length,truncated:end<text.length,text:text.slice(offset,end)});
      let low=offset+1,high=Math.min(offset+length,text.length),best=offset;
      while(low<=high){const middle=Math.floor((low+high)/2);if(JSON.stringify(make(middle)).length<=maxObservationChars){best=middle;low=middle+1;}else high=middle-1;}
      if(best<text.length && /[\uD800-\uDBFF]/.test(text[best-1]))best--;
      assert(best>offset,'Limite de observação não comporta o registro.',422);add(id,offset,best);
      return {observation:make(best),state:{record_ranges:Object.fromEntries(ranges)}};
    },
    async restore(state){for(const [id,list] of Object.entries(state?.record_ranges || {})){assert(texts.has(id),'Registro restaurado fora da tarefa.',409);for(const [start,end] of list){assert(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>start&&end<=texts.get(id).length,'Faixa restaurada inválida.',409);add(id,start,end);}}},
  };
}
