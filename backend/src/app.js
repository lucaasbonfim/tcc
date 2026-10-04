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
app.use(express.json());
app.use("/api", routes);
app.use(errorHandler);

export default app;
