import { Router } from "express";
import healthRoutes from "./health.routes.js";
import participantRoutes from "./participant.routes.js";
import useCaseRoutes from "./useCase.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/participants", participantRoutes);
router.use("/use-cases", useCaseRoutes);

export default router;
