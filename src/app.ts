import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import categoriesRouter from "./routes/categories.js";
import subcategoriesRouter from "./routes/subcategories.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições vindas deste IP, tente novamente mais tarde." },
});
app.use("/api/", limiter);

const publicPath = path.join(path.resolve(), "public");
app.use(express.static(publicPath));
app.use("/uploads", express.static(path.join(publicPath, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use("/api/categories", categoriesRouter);
app.use("/api/subcategories", subcategoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

app.use(errorHandler);

export default app;
