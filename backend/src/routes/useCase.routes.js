import { Router } from "express";
import {
  getUseCaseById,
  listUseCases,
} from "../controllers/useCase.controller.js";

const router = Router();

router.get("/", listUseCases);
router.get("/:id", getUseCaseById);

export default router;
