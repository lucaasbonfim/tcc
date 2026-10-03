import { Router } from "express";
import {
  getExperimentGroupById,
  listExperimentGroups,
} from "../controllers/experimentGroup.controller.js";

const router = Router();

router.get("/", listExperimentGroups);
router.get("/:id", getExperimentGroupById);

export default router;
