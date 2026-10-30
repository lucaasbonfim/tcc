export function csvCell(value) {
  let result = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(result)) result = `'${result}`;
  return `"${result.replaceAll('"','""')}"`;
}

export function exportCsv(data) {
  const header = ['record_type','id','run_id','project_id','code','status','related_ids','payload_json'];
  const rows = [];
  const add = (type,id,code,status,related,payload) => rows.push([type,id,data.id,data.project_id,code || '',status || '',related || [],payload]);
  add('run',data.id,'',data.status,[],{model:data.model,parameters:data.parameters,created_at:data.created_at,finished_at:data.finished_at,
    project:data.snapshot_data.project,code_version:data.snapshot_data.code_version,export_format_version:data.export_format_version});
  for (const doc of data.snapshot_data.documents) add('document',doc.id,'','',[],doc);
  for (const stage of data.stages) add('stage',stage.id,stage.agent,stage.status,[],stage);
  for (const attempt of data.attempts) add('attempt',attempt.id,'',attempt.status,[attempt.stage_id],attempt);
  for (const req of data.requirements) add('requirement',req.id,req.code,req.review_status,req.content.sources.map(source => source.document_id),req);
  for (const item of data.test_cases) add('test_case',item.id,item.code,item.review_status,item.content.requirement_codes,item);
  for (const link of data.traceability) add('traceability',link.test_case_id,'','',[link.requirement_id],link);
  for (const review of data.reviews) add('review',review.id,'',review.decision,[review.entity_id],review);
  for(const script of data.automated_tests || [])add('automated_test',script.id,'',script.review_status,[script.test_case_id],script);
  for(const job of data.execution_jobs || [])add('execution_job',job.id,'',job.status,[],job);
  for(const evidence of data.evidence || [])add('evidence',evidence.id,'',evidence.origin,[evidence.job_id],evidence);
  for(const result of data.test_results || [])add('test_result',result.id,'',result.status,[result.automated_test_id,result.test_case_id,result.evidence_id],result);
  for(const finding of data.findings || [])add('finding',finding.id,'',finding.review_status,[finding.requirement_id,finding.test_case_id,finding.automated_test_id,finding.test_result_id],finding);
  for(const part of data.requirement_parts || [])add('requirement_part',part.id,String(part.sequence),part.status,[],part);
  for(const part of data.test_parts || [])add('test_part',part.id,String(part.sequence),part.status,part.requirement_codes,part);
  if(data.test_coverage)add('test_coverage',data.id,'','',[],data.test_coverage);
  if(data.consolidation_data)add('requirement_consolidation',data.id,'','completed',[],data.consolidation_data);
  return '\uFEFF' + [header,...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
