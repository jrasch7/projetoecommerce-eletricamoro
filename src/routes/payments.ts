import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { z } from "zod";
import { paymentService } from "../services/paymentService.js";

const router = Router();

const PaymentConfigSchema = z.object({
  activeProvider: z.enum(["WhatsApp", "PagBank", "MercadoPago", "Cielo"]).optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  merchantId: z.string().optional(),
  pixKey: z.string().optional(),
  webhookUrl: z.string().optional(),
  cardBrands: z.array(z.string()).optional(),
});

router.get("/config", asyncHandler(async (_req, res) => {
  let config = await prisma.paymentConfig.findFirst();
  
  if (!config) {
    config = await prisma.paymentConfig.create({
      data: {
        activeProvider: "WhatsApp",
      },
    });
  }
  
  // Return config without sensitive fields for GET
  const { apiSecret, ...safeConfig } = config;
  res.json(safeConfig);
}));

router.post("/config", asyncHandler(async (req, res) => {
  const parsed = PaymentConfigSchema.parse(req.body);
  
  let config = await prisma.paymentConfig.findFirst();
  
  // Filter out undefined values
  const updateData: any = {};
  if (parsed.activeProvider !== undefined) updateData.activeProvider = parsed.activeProvider;
  if (parsed.apiKey !== undefined) updateData.apiKey = parsed.apiKey;
  if (parsed.apiSecret !== undefined) updateData.apiSecret = parsed.apiSecret;
  if (parsed.merchantId !== undefined) updateData.merchantId = parsed.merchantId;
  if (parsed.pixKey !== undefined) updateData.pixKey = parsed.pixKey;
  if (parsed.webhookUrl !== undefined) updateData.webhookUrl = parsed.webhookUrl;
  
  if (config) {
    config = await prisma.paymentConfig.update({
      where: { id: config.id },
      data: updateData,
    });
  } else {
    config = await prisma.paymentConfig.create({
      data: {
        activeProvider: parsed.activeProvider || "WhatsApp",
        apiKey: parsed.apiKey ?? null,
        apiSecret: parsed.apiSecret ?? null,
        merchantId: parsed.merchantId ?? null,
        pixKey: parsed.pixKey ?? null,
        webhookUrl: parsed.webhookUrl ?? null,
      },
    });
  }
  
  const { apiSecret, ...safeConfig } = config;
  res.json(safeConfig);
}));

// Webhook endpoint for payment providers
router.post("/webhook", asyncHandler(async (req, res) => {
  try {
    // Get provider from header or body
    const provider = req.headers['x-provider'] as string || req.body.provider;

    if (!provider) {
      res.status(400).json({ error: "Provider not specified" });
      return;
    }

    // Security: Validate IP whitelist (optional but recommended)
    const allowedIPs = process.env.WEBHOOK_ALLOWED_IPS?.split(',') || [];
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`Webhook request from unauthorized IP: ${clientIP}`);
      // In production, you might want to reject this
      // return res.status(403).json({ error: "Unauthorized IP" });
    }

    // Prepare webhook data with headers
    const webhookData = {
      body: req.body,
      headers: req.headers,
      token: req.headers['x-webhook-token'] as string
    };

    // Handle webhook through payment service
    const result = await paymentService.handleWebhook(provider, webhookData);
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message || "Webhook processing failed" });
  }
}));

// Process payment endpoint
router.post("/process", asyncHandler(async (req, res) => {
  try {
    const result = await paymentService.processPayment(req.body);
    res.json(result);
  } catch (error: any) {
    console.error('Payment processing error:', error);
    res.status(400).json({ error: error.message || "Payment processing failed" });
  }
}));

export default router;
