import { Router } from "express";
import { getExperimentTaskById } from "../controllers/experimentTask.controller.js";

const router = Router();

router.get("/:id", getExperimentTaskById);

export default router;
