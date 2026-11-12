import {AUTOMATION_AGENT_TOOLS} from './definition.js';

// Per-task restrictions are derived from immutable input; old definitions remain unchanged.
export function automationDeclarations(input,definition) {
  // Schema builders reuse primitive objects. Split aliases before binding individual fields.
  const declarations=JSON.parse(JSON.stringify(definition.tools ?? AUTOMATION_AGENT_TOOLS));
  if(definition.case_binding!=='exact-id/v1')return declarations;
  const ids=input.test_cases.map(row=>row.id),paths=input.generated_paths.map(row=>row.path),codes=input.requirements.map(row=>row.code);
  declarations.find(t=>t.name==='get_approved_case').parameters.properties.case_id.enum=ids;
  if(codes.length)declarations.find(t=>t.name==='get_approved_requirement').parameters.properties.requirement_code.enum=codes;
  const output=declarations.find(t=>t.name==='submit_automation').parameters.properties.output.properties;
  for(const kind of ['artifacts','unsupported_cases']){
    const id=output[kind].items.properties.test_case_id;
    id.enum=ids;
    id.description='Copie o ID exato do caso, mantendo todos os hífens. Não derive o ID do nome do arquivo.';
  }
  output.artifacts.items.properties.files.items.properties.path.enum=paths;
  return declarations;
}
