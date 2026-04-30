import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { CreateCouponSchema, UpdateCouponSchema, ValidateCouponSchema } from "../schemas/coupon.schema.js";

const router = Router();

function calculateDiscount(type: string, value: number, total: number): number {
  const rawDiscount = type === "PERCENT" ? total * (value / 100) : value;
  return Math.max(0, Math.min(total, rawDiscount));
}

function validateCouponBusinessRules(
  coupon: {
    active: boolean;
    expiresAt: Date | null;
    minOrder: number | null;
    maxUses: number | null;
    usedCount: number;
  },
  total: number,
): string | null {
  if (!coupon.active) return "Cupom inativo";
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return "Cupom expirado";
  if (coupon.minOrder !== null && total < coupon.minOrder) return `Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}`;
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return "Limite de uso do cupom atingido";
  return null;
}

router.get("/", requireAdmin, asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, skip, take: limitNum }),
    prisma.coupon.count(),
  ]);

  res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = CreateCouponSchema.parse(req.body);

  const exists = await prisma.coupon.findUnique({ where: { code: parsed.code } });
  if (exists) throw new ConflictError("Já existe um cupom com este código");

  const coupon = await prisma.coupon.create({
    data: {
      code: parsed.code,
      type: parsed.type,
      value: parsed.value,
      minOrder: parsed.minOrder,
      maxUses: parsed.maxUses,
      expiresAt: parsed.expiresAt,
      active: parsed.active,
    },
  });

  res.status(201).json(coupon);
}));

router.put("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const parsed = UpdateCouponSchema.parse(req.body);

  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Cupom");

  if (parsed.code && parsed.code !== current.code) {
    const exists = await prisma.coupon.findUnique({ where: { code: parsed.code } });
    if (exists) throw new ConflictError("Já existe um cupom com este código");
  }

  const data: Parameters<typeof prisma.coupon.update>[0]["data"] = {};
  if (parsed.code !== undefined) data.code = parsed.code;
  if (parsed.type !== undefined) data.type = parsed.type;
  if (parsed.value !== undefined) data.value = parsed.value;
  if (parsed.minOrder !== undefined) data.minOrder = parsed.minOrder;
  if (parsed.maxUses !== undefined) data.maxUses = parsed.maxUses;
  if (parsed.expiresAt !== undefined) data.expiresAt = parsed.expiresAt;
  if (parsed.active !== undefined) data.active = parsed.active;

  const coupon = await prisma.coupon.update({ where: { id }, data });
  res.json(coupon);
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.coupon.delete({ where: { id } });
  res.status(204).send();
}));

router.post("/validate", asyncHandler(async (req, res) => {
  const parsed = ValidateCouponSchema.parse(req.body);
  const coupon = await prisma.coupon.findUnique({ where: { code: parsed.code } });

  if (!coupon) {
    res.status(404).json({ valid: false, error: "Cupom não encontrado" });
    return;
  }

  const ruleError = validateCouponBusinessRules(coupon, parsed.total);
  if (ruleError) {
    res.status(400).json({ valid: false, error: ruleError });
    return;
  }

  const discount = calculateDiscount(coupon.type, coupon.value, parsed.total);
  const totalWithDiscount = Math.max(0, parsed.total - discount);

  res.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
    },
    discount,
    totalWithDiscount,
  });
}));

export default router;
