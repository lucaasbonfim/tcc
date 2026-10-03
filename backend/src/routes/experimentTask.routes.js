import { Router } from "express";
import {
  getExperimentTaskById,
  startExperimentTaskController,
} from "../controllers/experimentTask.controller.js";
import {
  createManualTestCaseController,
  listExperimentTaskTestCases,
} from "../controllers/testCase.controller.js";

const router = Router();

router.patch("/:id/start", startExperimentTaskController);
router.get("/:taskId/test-cases", listExperimentTaskTestCases);
router.post("/:taskId/test-cases", createManualTestCaseController);
router.get("/:id", getExperimentTaskById);

export default router;
