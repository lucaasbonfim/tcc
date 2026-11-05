import {preserveSnapshot,appendRunEvent} from './run-events.js';
export async function recordAttemptInput(db,job,artifact,{effective=false}={}) {
  if(!artifact)return;
  const source_key=`attempt:${job.attemptId}:${effective?'effective-input':'input'}`;
  const snapshot=await preserveSnapshot(db,{run_id:job.run.id,stage_id:job.stage.id,attempt_id:job.attemptId,source_key,kind:'input',label:effective?'Entrada efetiva preservada':'Entradas da tarefa',artifact});
  await appendRunEvent(db,{run_id:job.run.id,stage_id:job.stage.id,attempt_id:job.attemptId,source_key,kind:effective?'input_effective':'input_prepared',agent:job.stage.agent,snapshot_id:snapshot.id,payload:{phase:job.stage.context?.phase,part_sequence:(job.part||job.testPart||job.automationPart)?.sequence}});
}
export async function recordAttemptOutput(db,store,job,{inputRef,outputRef,output,error,late=false}) {
  if(inputRef){const initial=(await db.query('SELECT artifact FROM research.artifact_snapshots WHERE run_id=$1 AND source_key=$2',[job.run.id,`attempt:${job.attemptId}:input`])).rows[0];if(!initial)await recordAttemptInput(db,job,inputRef);else if(initial.artifact.sha256!==inputRef.sha256)await recordAttemptInput(db,job,inputRef,{effective:true});}
  if(!outputRef)return;
  let artifacts=[],mapping=null;
  if(!late && !error) {
    if(job.stage.agent==='requirements')artifacts=(await db.query('SELECT * FROM research.requirements WHERE run_id=$1 ORDER BY code',[job.run.id])).rows;
    else if(job.stage.agent==='tests'){
      if(job.testPart){mapping=(await db.query('SELECT mapping FROM research.test_parts WHERE id=$1',[job.testPart.id])).rows[0].mapping;artifacts=(await db.query('SELECT * FROM research.test_cases WHERE run_id=$1 AND id=ANY($2::uuid[]) ORDER BY code',[job.run.id,mapping.map(m=>m.test_case_id)])).rows;}
      else artifacts=(await db.query('SELECT * FROM research.test_cases WHERE run_id=$1 ORDER BY code',[job.run.id])).rows;
    }else if(job.stage.agent==='automation'){artifacts=(await db.query('SELECT * FROM research.automated_tests WHERE run_id=$1 AND generation_attempt_id=$2 ORDER BY id',[job.run.id,job.attemptId])).rows;for(const row of artifacts)row.files_data=await store.json(row.files);}
    else if(job.stage.agent==='evaluation')artifacts=(await db.query('SELECT * FROM research.findings WHERE run_id=$1 AND evaluation_attempt_id=$2 ORDER BY id',[job.run.id,job.attemptId])).rows;
  }
  const data={agent:job.stage.agent,phase:job.stage.context?.phase,part_sequence:(job.part||job.testPart||job.automationPart)?.sequence,late,validation_error:error||null,raw_ref:outputRef,mapping,artifacts,
    ...(!artifacts.length?{proposed_output:output ?? await store.json(outputRef)}:{})};
  let artifact;try{artifact=await store.put(data);}catch(failure){if(failure.statusCode!==413)throw failure;artifact=await store.put({...data,artifacts:[],proposed_output:undefined,raw_only:true,limitation:'Conteúdo normalizado excede 12 MiB; consulte a saída original preservada e o mapeamento.',raw_ref:outputRef});}
  const source_key=`attempt:${job.attemptId}:${late?'late-output':'output'}`;
  const snapshot=await preserveSnapshot(db,{run_id:job.run.id,stage_id:job.stage.id,attempt_id:job.attemptId,source_key,kind:job.executionJob?'execution':'output',label:late?'Resposta tardia, não aplicada':error?'Saída recusada pela validação':'Saída e artefatos preservados',artifact});
  await appendRunEvent(db,{run_id:job.run.id,source_key,kind:late?'late_output':error?'output_rejected':'artifact_produced',actor:job.executionJob?'executor':'agent',agent:job.stage.agent,stage_id:job.stage.id,attempt_id:job.attemptId,job_id:job.executionJob?.id,snapshot_id:snapshot.id,payload:{phase:job.stage.context?.phase,part_sequence:data.part_sequence,count:artifacts.length,error:error||null}});
}
