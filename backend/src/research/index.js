import pool from '../config/database.js';
import { createArtifactStore } from './artifacts.js';
import { createProjectService } from './projects.js';
import { createResearchRouter } from './routes.js';

const store = createArtifactStore();
const projects = createProjectService({ pool, store });
export default createResearchRouter({ projects, store });
