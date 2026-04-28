import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { CreateProductSchema, UpdateProductSchema } from "../schemas/product.schema.js";

const router = Router();

router.get("/", asyncHandler(async (req, res) => {
  const subCategoryId = req.query["subCategoryId"];
  const categoryId = req.query["categoryId"];
  const pageNum = Math.max(1, parseInt(String(req.query["page"] ?? "1")));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
  const skip = (pageNum - 1) * limitNum;

  const where = subCategoryId
    ? { subCategoryId: String(subCategoryId) }
    : categoryId
      ? { subCategory: { categoryId: String(categoryId) } }
      : {};

  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { 
        subCategory: true,
        variants: true
      },
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.count({ where }),
  ]);

  // Calculate order count for each product
  const orders = await prisma.order.findMany({
    select: { items: true },
  });

  const productOrderCount = new Map<string, number>();
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        const productId = item.id;
        const quantity = item.quantity || 1;
        productOrderCount.set(productId, (productOrderCount.get(productId) || 0) + quantity);
      });
    }
  });

  // Add order count to each product
  const productsWithOrderCount = data.map(product => ({
    ...product,
    orderCount: productOrderCount.get(product.id) || 0,
  }));

  res.json({ data: productsWithOrderCount, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
}));

router.post("/", upload.array("images", 5), asyncHandler(async (req, res) => {
  const parsed = CreateProductSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[]) ?? [];
  const product = await prisma.product.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      price: parsed.price,
      stock: parsed.stock,
      subCategoryId: parsed.subCategoryId,
      is_featured: parsed.is_featured,
      on_sale: parsed.on_sale,
      brand: parsed.brand,
      model: parsed.model,
      voltage: parsed.voltage,
      images: files.map((f) => `/uploads/${f.filename}`),
    },
  });
  res.status(201).json(product);
}));

router.put("/:id", upload.array("images", 5), asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const parsed = UpdateProductSchema.parse(req.body);
  const files = (req.files as Express.Multer.File[]) ?? [];

  const data: Parameters<typeof prisma.product.update>[0]["data"] = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.price !== undefined) data.price = parsed.price;
  if (parsed.stock !== undefined) data.stock = parsed.stock;
  if (parsed.subCategoryId !== undefined) data.subCategoryId = parsed.subCategoryId;
  if (parsed.is_featured !== undefined) data.is_featured = parsed.is_featured;
  if (parsed.on_sale !== undefined) data.on_sale = parsed.on_sale;
  if (parsed.brand !== undefined) data.brand = parsed.brand;
  if (parsed.model !== undefined) data.model = parsed.model;
  if (parsed.voltage !== undefined) data.voltage = parsed.voltage;
  if (files.length > 0) data.images = files.map((f) => `/uploads/${f.filename}`);

  const product = await prisma.product.update({ where: { id }, data });
  res.json(product);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.product.delete({ where: { id } });
  res.status(204).send();
}));

router.get("/suggested", asyncHandler(async (req, res) => {
  const categoryIds = req.query["categoryIds"] as string;
  
  if (!categoryIds) {
    // Return random featured products if no history
    const products = await prisma.product.findMany({
      where: { is_featured: true },
      include: { subCategory: true, variants: true },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    // Shuffle for randomness
    const shuffled = products.sort(() => Math.random() - 0.5);
    return res.json(shuffled.slice(0, 6));
  }

  const ids = categoryIds.split(",").filter(Boolean);
  
  if (ids.length === 0) {
    const products = await prisma.product.findMany({
      where: { is_featured: true },
      include: { subCategory: true, variants: true },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    const shuffled = products.sort(() => Math.random() - 0.5);
    return res.json(shuffled.slice(0, 6));
  }

  // Get products from the visited categories
  const categoryProducts = await prisma.product.findMany({
    where: {
      subCategory: {
        categoryId: { in: ids },
      },
    },
    include: { subCategory: true, variants: true },
    take: 20,
  });

  // Shuffle and return up to 6 products
  const shuffled = categoryProducts.sort(() => Math.random() - 0.5);
  return res.json(shuffled.slice(0, 6));
}));

export default router;
