import { Router } from "express";
import rateLimit from "express-rate-limit";
import { trustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  adminLogin,
  getAuthenticatedSession,
  logout,
} from "../controllers/auth.controller.js";

const router = Router();
router.use(trustedOrigin);
const adminLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: {
    error: "Muitas tentativas de login. Tente novamente em alguns minutos.",
  },
});

router.post("/admin/login", adminLoginRateLimit, adminLogin);
router.get("/me", getAuthenticatedSession);
router.post("/logout", logout);

export default router;
