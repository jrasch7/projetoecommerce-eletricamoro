import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { CreateOrderSchema, UpdateOrderSchema } from "../schemas/order.schema.js";
import { authenticateToken } from "./auth.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
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

// Get customer's orders (requires authentication)
router.get("/my-account", authenticateToken, asyncHandler(async (req: any, res) => {
  const orders = await prisma.order.findMany({
    where: {
      customerId: req.customer.customerId
    },
    orderBy: { createdAt: "desc" },
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
  
  res.json(orders);
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = CreateOrderSchema.parse(req.body);
  
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
  
  const order = await prisma.order.create({
    data: {
      customer: parsed.customer,
      total: parsed.total,
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
  
  // Optionally: Decrease variant stock after order creation
  if (parsed.items && Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (item.variantIds && Array.isArray(item.variantIds) && item.variantIds.length > 0) {
        const requestedQty = item.quantity || 1;
        for (const variantId of item.variantIds) {
          await prisma.productVariant.update({
            where: { id: variantId },
            data: {
              stock: {
                decrement: requestedQty
              }
            }
          });
        }
      }
    }
  }
  
  res.status(201).json(order);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const { status, payment } = UpdateOrderSchema.parse(req.body);
  const data: { status?: string; payment?: string } = {};
  if (status !== undefined) data.status = status;
  if (payment !== undefined) data.payment = payment;
  const order = await prisma.order.update({ where: { id }, data });
  res.json(order);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.order.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
