import { Router } from "express";
import {
  createUseCaseController,
  getUseCaseById,
  listUseCases,
} from "../controllers/useCase.controller.js";

const router = Router();

router.get("/", listUseCases);
router.post("/", createUseCaseController);
router.get("/:id", getUseCaseById);

export default router;
