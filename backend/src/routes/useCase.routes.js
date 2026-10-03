import { Router } from "express";
import {
  createUseCaseController,
  getUseCaseById,
  listUseCases,
  updateUseCaseController,
} from "../controllers/useCase.controller.js";

const router = Router();

router.get("/", listUseCases);
router.post("/", createUseCaseController);
router.get("/:id", getUseCaseById);
router.put("/:id", updateUseCaseController);

export default router;
