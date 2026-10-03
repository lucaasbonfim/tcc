import { Router } from "express";
import {
  getExperimentTaskById,
  startExperimentTaskController,
} from "../controllers/experimentTask.controller.js";

const router = Router();

router.patch("/:id/start", startExperimentTaskController);
router.get("/:id", getExperimentTaskById);

export default router;
