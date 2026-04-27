import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { CreateOrderSchema, UpdateOrderSchema } from "../schemas/order.schema.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
  const skip = (pageNum - 1) * limitNum;

  const [data, total] = await prisma.$transaction([
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, skip, take: limitNum }),
    prisma.order.count(),
  ]);

  res.json({ data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = CreateOrderSchema.parse(req.body);
  const order = await prisma.order.create({
    data: {
      customer: parsed.customer,
      total: parsed.total,
      status: parsed.status,
      payment: parsed.payment,
      address: parsed.address,
      items: parsed.items,
    },
  });
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
