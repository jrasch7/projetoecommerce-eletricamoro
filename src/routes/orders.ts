import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { CreateOrderSchema, UpdateOrderSchema } from "../schemas/order.schema.js";
import { requireAuth, type AuthRequest } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { AppError } from "../lib/errors.js";

const router = Router();

function calculateItemsSubtotal(items: unknown[]): number {
  return items.reduce<number>((sum, item) => {
    if (!item || typeof item !== "object") return sum;
    const product = item as Record<string, unknown>;
    const price = Number(product["price"] ?? 0);
    const quantity = Number(product["quantity"] ?? 1);
    if (Number.isNaN(price) || Number.isNaN(quantity) || quantity <= 0) return sum;
    return sum + price * quantity;
  }, 0);
}

function calculateCouponDiscount(type: string, value: number, subtotal: number): number {
  const raw = type === "PERCENT" ? subtotal * (value / 100) : value;
  return Math.max(0, Math.min(subtotal, raw));
}

router.get("/", requireAdmin, asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.order.findMany({ 
      orderBy: { createdAt: "desc" }, 
      skip, 
      take: limitNum,
      include: {
        customerRef: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    }),
    prisma.order.count(),
  ]);

  res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));

// Track order without login (by email/CPF + order ID)
router.get("/track", asyncHandler(async (req, res) => {
  const { identifier, orderNumber } = req.query;
  
  if (!identifier || !orderNumber) {
    res.status(400).json({ error: "Identifier and order number are required" });
    return;
  }
  
  const order = await prisma.order.findFirst({
    where: {
      id: orderNumber as string,
      OR: [
        { customerEmail: identifier as string },
        { customerCpf: identifier as string },
      ]
    },
    include: {
      customerRef: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      }
    }
  });
  
  if (!order) {
    res.status(404).json({ error: "Order not found or credentials don't match" });
    return;
  }
  
  // Return limited order data for privacy
  res.json({
    id: order.id,
    customer: order.customer,
    total: order.total,
    status: order.status,
    payment: order.payment,
    paymentMethod: order.paymentMethod,
    transactionId: order.transactionId,
    address: order.address,
    items: order.items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    isRegisteredCustomer: !!order.customerId,
  });
}));

// Get customer's orders (requires authentication via Supabase Auth)
router.get("/my-account", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = req.authUser!;
  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      customerRef: {
        select: { id: true, name: true, email: true },
      },
    },
  });
  res.json(orders);
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = CreateOrderSchema.parse(req.body);
  const subtotal = calculateItemsSubtotal(parsed.items);
  let discountAmount = 0;
  let couponCode: string | null = null;

  if (parsed.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: parsed.couponCode } });
    if (!coupon) throw new AppError(400, "Cupom não encontrado");
    if (!coupon.active) throw new AppError(400, "Cupom inativo");
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) throw new AppError(400, "Cupom expirado");
    if (coupon.minOrder !== null && subtotal < coupon.minOrder) {
      throw new AppError(400, `Pedido mínimo para este cupom: R$ ${coupon.minOrder.toFixed(2)}`);
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new AppError(400, "Limite de uso do cupom atingido");
    }

    discountAmount = calculateCouponDiscount(coupon.type, coupon.value, subtotal);
    couponCode = coupon.code;
  }

  const totalAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Validate variant stock if items contain variant information
  if (parsed.items && Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (item.variantIds && Array.isArray(item.variantIds) && item.variantIds.length > 0) {
        // Check stock for each variant
        for (const variantId of item.variantIds) {
          const variant = await prisma.productVariant.findUnique({
            where: { id: variantId }
          });
          
          if (!variant) {
            res.status(400).json({ error: `Variante não encontrada: ${variantId}` });
            return;
          }

          if (variant.stock <= 0) {
            res.status(400).json({ error: `Variante "${variant.name}" está sem estoque` });
            return;
          }

          // Check if requested quantity is available
          const requestedQty = item.quantity || 1;
          if (variant.stock < requestedQty) {
            res.status(400).json({
              error: `Estoque insuficiente para variante "${variant.name}". Disponível: ${variant.stock}, Solicitado: ${requestedQty}`
            });
            return;
          }
        }
      }
    }
  }
  
  const order = await prisma.$transaction(async (tx) => {
    if (couponCode) {
      const couponSnapshot = await tx.coupon.findUnique({ where: { code: couponCode } });
      if (!couponSnapshot || !couponSnapshot.active) {
        throw new AppError(400, "Cupom indisponível no momento da finalização");
      }
      if (couponSnapshot.expiresAt && couponSnapshot.expiresAt.getTime() < Date.now()) {
        throw new AppError(400, "Cupom expirado");
      }
      if (couponSnapshot.minOrder !== null && subtotal < couponSnapshot.minOrder) {
        throw new AppError(400, `Pedido mínimo para este cupom: R$ ${couponSnapshot.minOrder.toFixed(2)}`);
      }
      if (couponSnapshot.maxUses !== null && couponSnapshot.usedCount >= couponSnapshot.maxUses) {
        throw new AppError(400, "Limite de uso do cupom atingido");
      }

      const updateWhere =
        couponSnapshot.maxUses === null
          ? { id: couponSnapshot.id }
          : { id: couponSnapshot.id, usedCount: { lt: couponSnapshot.maxUses } };
      const couponUpdate = await tx.coupon.updateMany({
        where: updateWhere,
        data: { usedCount: { increment: 1 } },
      });
      if (couponUpdate.count === 0) {
        throw new AppError(400, "Cupom indisponível no momento da finalização");
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        customer: parsed.customer,
        total: totalAfterDiscount,
        subtotal,
        discountAmount,
        couponCode,
        status: parsed.status,
        payment: parsed.payment,
        paymentMethod: parsed.paymentMethod ?? null,
        address: parsed.address,
        items: parsed.items,
        customerId: parsed.customerId ?? null,
        customerEmail: parsed.customerEmail ?? null,
        customerCpf: parsed.customerCpf ?? null,
      },
    });

    if (parsed.items && Array.isArray(parsed.items)) {
      for (const item of parsed.items) {
        if (item.variantIds && Array.isArray(item.variantIds) && item.variantIds.length > 0) {
          const requestedQty = item.quantity || 1;
          for (const variantId of item.variantIds) {
            await tx.productVariant.update({
              where: { id: variantId },
              data: {
                stock: {
                  decrement: requestedQty,
                },
              },
            });
          }
        }
      }
    }

    return createdOrder;
  });

  res.status(201).json(order);
}));

router.put("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const { status, payment } = UpdateOrderSchema.parse(req.body);
  const data: { status?: string; payment?: string } = {};
  if (status !== undefined) data.status = status;
  if (payment !== undefined) data.payment = payment;
  const order = await prisma.order.update({ where: { id }, data });
  res.json(order);
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.order.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
