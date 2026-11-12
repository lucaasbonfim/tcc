import {randomUUID} from 'node:crypto';
import {assert,text,transaction,uuid} from '../shared/errors.js';
import {preserveSnapshot,appendRunEvent} from '../storage/run-events.js';
export function createAssessmentService({pool,store}) {
  return {
    async list(runId){assert((await pool.query('SELECT id FROM research.runs WHERE id=$1',[runId])).rowCount,'Análise não encontrada.',404);return (await pool.query('SELECT * FROM research.experiment_assessments WHERE run_id=$1 ORDER BY created_at,id',[runId])).rows;},
    async create(runId,input) {
      assert(['correct','partial','incorrect','inconclusive'].includes(input.verdict),'Julgamento inválido.',422);
      const justification=text(input.justification,'Justificativa do julgamento',5000,true),reference_note=text(input.reference_note,'Referência consultada',5000);
      const target=input.snapshot_id ?? null;if(target)uuid(target);
      return transaction(pool,async db=>{
        const run=(await db.query('SELECT * FROM research.runs WHERE id=$1 FOR UPDATE',[runId])).rows[0];assert(run,'Análise não encontrada.',404);
        assert(['completed','failed','cancelled'].includes(run.status),'O julgamento posterior exige término, falha ou cancelamento da análise.',409);
        if(target)assert((await db.query('SELECT id FROM research.artifact_snapshots WHERE run_id=$1 AND id=$2',[runId,target])).rowCount,'Snapshot fora desta análise.',404);
        const id=randomUUID(),data={id,run_id:runId,target_snapshot_id:target,verdict:input.verdict,justification,reference_note,actor:'admin'},artifact=await store.put(data);
        const row=(await db.query("INSERT INTO research.experiment_assessments(id,run_id,snapshot_id,verdict,justification,reference_note,artifact,actor) VALUES($1,$2,$3,$4,$5,$6,$7,'admin') RETURNING *",[id,runId,target,input.verdict,justification,reference_note,artifact])).rows[0];
        const snapshot=await preserveSnapshot(db,{run_id:runId,source_key:`assessment:${id}`,kind:'artifact',label:'Julgamento humano posterior',artifact});
        await appendRunEvent(db,{run_id:runId,source_key:`assessment:${id}`,kind:'human_assessment',actor:'human',snapshot_id:snapshot.id,payload:{assessment_id:id,target_snapshot_id:target,verdict:input.verdict}});return row;
      });
    },
  };
}
