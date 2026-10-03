import { Router } from "express";
import {
  createUseCaseController,
  deleteUseCaseController,
  getUseCaseById,
  listUseCases,
  updateUseCaseController,
} from "../controllers/useCase.controller.js";

const router = Router();

router.get("/", listUseCases);
router.post("/", createUseCaseController);
router.get("/:id", getUseCaseById);
router.put("/:id", updateUseCaseController);
router.delete("/:id", deleteUseCaseController);

export default router;
