import pool from '../config/database.js';
import { createArtifactStore } from './artifacts.js';
import { createProjectService } from './projects.js';
import { createResearchRouter } from './routes.js';
import { createRunService } from './runs.js';
import { createAutomationService } from './automation.js';

const store = createArtifactStore();
const projects = createProjectService({ pool, store });
const runs = createRunService({ pool,store });
export default createResearchRouter({ projects, store, runs, automation:createAutomationService({pool,store}) });
