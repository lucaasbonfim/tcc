import { Router } from "express";
import experimentGroupRoutes from "./experimentGroup.routes.js";
import healthRoutes from "./health.routes.js";
import participantRoutes from "./participant.routes.js";
import useCaseRoutes from "./useCase.routes.js";

const router = Router();

router.use("/experiment-groups", experimentGroupRoutes);
router.use("/health", healthRoutes);
router.use("/participants", participantRoutes);
router.use("/use-cases", useCaseRoutes);

export default router;
