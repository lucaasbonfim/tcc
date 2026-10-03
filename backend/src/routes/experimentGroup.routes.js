import { Router } from "express";
import {
  getExperimentGroupById,
  listExperimentGroups,
  listExperimentGroupTasks,
} from "../controllers/experimentGroup.controller.js";

const router = Router();

router.get("/", listExperimentGroups);
router.get("/:id/tasks", listExperimentGroupTasks);
router.get("/:id", getExperimentGroupById);

export default router;
