import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import routes from "./routes/index.js";

const app = express();
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '256kb', inflate: false }));
app.use((_request, response, next) => {
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Cache-Control', 'no-store');
  next();
});
app.use("/api", routes);
app.use((_request, response) => response.status(404).json({ error: 'Rota não encontrada.' }));
app.use(errorHandler);

export default app;
