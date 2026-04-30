import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { supabasePublic } from "../lib/supabase.js";

const router = Router();

/**
 * GET /api/checkout/session
 * Público. Opcionalmente aceita Bearer token para retornar dados do cliente.
 * Retorna paymentConfig (sem secrets) + storeConfig + customer (se autenticado).
 */
router.get(
  "/session",
  asyncHandler(async (req, res) => {
    // Busca paymentConfig e storeConfig em paralelo
    const [paymentConfigRaw, storeConfigRaw] = await Promise.all([
      prisma.paymentConfig.findFirst(),
      prisma.storeConfig.findFirst(),
    ]);

    // PaymentConfig sem campos sensíveis
    let paymentConfig = paymentConfigRaw
      ? (({ apiSecret, ...safe }) => safe)(paymentConfigRaw as typeof paymentConfigRaw & { apiSecret?: string })
      : {
          activeProvider: "WhatsApp",
          enabledMethods: ["WHATSAPP"],
          methodProviders: { WHATSAPP: "WhatsApp" },
          cardBrands: ["visa", "mastercard"],
        };

    // Garante padrões mínimos
    if (!paymentConfig) {
      paymentConfig = {
        activeProvider: "WhatsApp",
        enabledMethods: ["WHATSAPP"],
        methodProviders: { WHATSAPP: "WhatsApp" },
        cardBrands: ["visa", "mastercard"],
      } as typeof paymentConfig;
    }

    const storeConfig = (storeConfigRaw?.config as Record<string, unknown>) ?? {};

    // Tenta autenticar o usuário opcionalmente (sem rejeitar se não tiver token)
    let customer = null;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (token) {
      try {
        const { data, error } = await supabasePublic.auth.getUser(token);
        if (!error && data.user) {
          const userId = data.user.id;
          const customerRecord = await prisma.customer.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, cpf: true, phone: true, address: true },
          });
          if (customerRecord) {
            customer = customerRecord;
          } else {
            // Usuário autenticado mas sem registro Customer ainda
            customer = {
              id: userId,
              name: data.user.user_metadata?.["name"] as string | null ?? null,
              email: data.user.email ?? null,
              cpf: null,
              phone: null,
              address: null,
            };
          }
        }
      } catch {
        // Silently ignore auth errors — checkout still works as guest
      }
    }

    res.json({ paymentConfig, storeConfig, customer });
  }),
);

export default router;
