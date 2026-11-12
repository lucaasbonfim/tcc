import pool from '../config/database.js';
import { createArtifactStore } from './storage/artifacts.js';
import { createProjectService } from './services/projects.js';
import { createResearchRouter } from './http/routes.js';
import { createRunService } from './services/runs.js';
import { createAutomationService } from './services/automation.js';
import {createExecutionService} from './services/execution.js';
import {createEvaluationService} from './services/evaluation.js';

const store = createArtifactStore();
const projects = createProjectService({ pool, store });
const runs = createRunService({ pool,store });
export default createResearchRouter({ projects, store, runs, automation:createAutomationService({pool,store}),execution:createExecutionService({pool,store}),evaluation:createEvaluationService({pool,store}) });
