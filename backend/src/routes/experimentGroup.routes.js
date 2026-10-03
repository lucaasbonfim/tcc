import { Router } from "express";
import { listExperimentGroups } from "../controllers/experimentGroup.controller.js";

const router = Router();

router.get("/", listExperimentGroups);

export default router;
