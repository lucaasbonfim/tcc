import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.js";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use("/api", routes);
app.use(errorHandler);

export default app;
