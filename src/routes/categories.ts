import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { NotFoundError } from "../lib/errors.js";
import { CreateCategorySchema, UpdateCategorySchema } from "../schemas/category.schema.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({ include: { subCategories: true } });
  res.json(categories);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const category = await prisma.category.findUnique({
    where: { id },
    include: { subCategories: true },
  });
  if (!category) throw new NotFoundError("Categoria");
  res.json(category);
}));

router.get("/:id/subcategories", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const subcategories = await prisma.subCategory.findMany({
    where: { categoryId: id },
  });
  res.json(subcategories);
}));

router.post("/", upload.single("photo"), asyncHandler(async (req, res) => {
  const { name } = CreateCategorySchema.parse(req.body);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const category = await prisma.category.create({ data: { name, imageUrl } });
  res.status(201).json(category);
}));

router.put("/:id", upload.single("photo"), asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const { name } = UpdateCategorySchema.parse(req.body);
  const data: { name?: string; imageUrl?: string } = {};
  if (name !== undefined) data.name = name;
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;
  const category = await prisma.category.update({ where: { id }, data });
  res.json(category);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.category.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
