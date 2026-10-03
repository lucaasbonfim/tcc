import { Router } from "express";
import { listParticipantsProgress } from "../controllers/admin.controller.js";

const router = Router();

router.get("/participants", listParticipantsProgress);

export default router;
