import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import { prisma } from "./lib/prisma.js";

import categoriesRouter from "./routes/categories.js";
import subcategoriesRouter from "./routes/subcategories.js";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import configRouter from "./routes/config.js";
import paymentsRouter from "./routes/payments.js";
import authRouter from "./routes/auth.js";
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

// Middleware to inject CSS variables into HTML files
app.get(/\.html$/, async (req, res, next) => {
  try {
    const filePath = path.join(publicPath, req.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return next();
    }

    // Fetch store config
    let config = null;
    try {
      const storeConfig = await prisma.storeConfig.findFirst();
      if (storeConfig && storeConfig.config) {
        config = storeConfig.config;
      }
    } catch (err) {
      console.warn('Failed to fetch store config for HTML injection:', err);
    }

    // Read HTML file
    let html = fs.readFileSync(filePath, 'utf-8');

    // Inject CSS variables if config exists
    if (config) {
      const themeConfig = config as any;
      const primaryColor = themeConfig.primaryColor || '#0a2540';
      const secondaryColor = themeConfig.secondaryColor || '#1a365d';
      const accentColor = themeConfig.accentColor || '#e74c3c';
      const fontFamily = themeConfig.fontFamily || 'Inter';
      
      const injectedStyle = `<style>:root{--color-primary:${primaryColor};--color-secondary:${secondaryColor};--color-accent:${accentColor};--font-family:'${fontFamily}',sans-serif;}</style>`;
      
      // Replace <head> with <head> + injected style
      html = html.replace('<head>', `<head>${injectedStyle}`);
    }

    res.send(html);
  } catch (err) {
    console.error('Error injecting CSS variables:', err);
    next();
  }
});

app.use(express.static(publicPath));
app.use("/uploads", express.static(path.join(publicPath, "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use("/api/categories", categoriesRouter);
app.use("/api/subcategories", subcategoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/config", configRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/auth", authRouter);

app.use(errorHandler);

export default app;
