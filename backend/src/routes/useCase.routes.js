import { Router } from "express";
import { listUseCases } from "../controllers/useCase.controller.js";

const router = Router();

router.get("/", listUseCases);

export default router;
