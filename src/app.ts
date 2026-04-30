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
import customerRouter from "./routes/customer.js";
import adminRouter from "./routes/admin.js";
import couponsRouter from "./routes/coupons.js";
import checkoutRouter from "./routes/checkout.js";
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

// Renderiza HTML com tema injetado server-side (zero flash). Inclui também
// o config completo como JSON em <script id="ssr-config"> pra theme-config.js
// pular o fetch async e aplicar sincronicamente.
async function renderWithSsrTheme(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;

  let config: Record<string, unknown> | null = null;
  try {
    const storeConfig = await prisma.storeConfig.findFirst();
    if (storeConfig && storeConfig.config) {
      config = storeConfig.config as Record<string, unknown>;
    }
  } catch (err) {
    console.warn("Failed to fetch store config for HTML injection:", err);
  }

  let html = fs.readFileSync(filePath, "utf-8");
  const themeConfig = (config ?? {}) as Record<string, string>;
  const primaryColor = themeConfig["primaryColor"] || "#0a2540";
  const secondaryColor = themeConfig["secondaryColor"] || "#1a365d";
  const accentColor = themeConfig["accentColor"] || "#e74c3c";
  const fontFamily = themeConfig["fontFamily"] || "Inter";

  // CSS vars + serialização do config completo como JSON (pra theme-config.js).
  // O <style> e o <script id="ssr-config"> precisam vir ANTES do tailwind CDN
  // pra colors do config tailwind avaliarem var(--color-*) já preenchidas.
  const injected = `<style>:root{--color-primary:${primaryColor};--color-secondary:${secondaryColor};--color-accent:${accentColor};--font-family:'${fontFamily}',sans-serif;}body{font-family:var(--font-family);}</style>` +
    `<script id="ssr-config" type="application/json">${JSON.stringify(config ?? {}).replace(/</g, "\\u003c")}</script>`;

  return html.replace("<head>", `<head>${injected}`);
}

// Intercepta tanto `/`, `/foo` (sem extensão) quanto `*.html` pra servir com SSR.
app.get(/^\/(?!api\/|uploads\/|js\/|img\/|favicon\.).*?(\.html)?$/, async (req, res, next) => {
  try {
    let pathPart = req.path === "/" ? "/index.html" : req.path;
    if (!pathPart.endsWith(".html")) {
      // se path é /foo, tenta /foo.html
      pathPart = `${pathPart}.html`;
    }
    const filePath = path.join(publicPath, pathPart);
    const html = await renderWithSsrTheme(filePath);
    if (!html) return next();
    res.send(html);
  } catch (err) {
    console.error("Error injecting CSS variables:", err);
    next();
  }
});

// Injeta a configuração pública do Supabase (URL + anon key) como JS,
// evitando hardcode no HTML. O anon key é seguro no browser por design.
app.get("/js/supabase-config.js", (_req, res) => {
  const cfg = {
    url: process.env["SUPABASE_URL"] || "",
    anonKey: process.env["SUPABASE_ANON_KEY"] || "",
  };
  res.type("application/javascript").send(`window.SUPABASE_CONFIG = ${JSON.stringify(cfg)};`);
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
app.use("/api/customer", customerRouter);
app.use("/api/admin", adminRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/checkout", checkoutRouter);

app.use(errorHandler);

export default app;
