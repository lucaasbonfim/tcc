import { Router } from "express";
import {
  adminLogin,
  getAuthenticatedSession,
  logout,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/admin/login", adminLogin);
router.get("/me", getAuthenticatedSession);
router.post("/logout", logout);

export default router;
