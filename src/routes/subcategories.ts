import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { NotFoundError } from "../lib/errors.js";
import { CreateSubCategorySchema, UpdateSubCategorySchema } from "../schemas/subcategory.schema.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const subcategories = await prisma.subCategory.findMany({ include: { category: true } });
  res.json(subcategories);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const subcategory = await prisma.subCategory.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!subcategory) throw new NotFoundError("Subcategoria");
  res.json(subcategory);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name, categoryId } = CreateSubCategorySchema.parse(req.body);
  const subCategory = await prisma.subCategory.create({ data: { name, categoryId } });
  res.status(201).json(subCategory);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  const { name, categoryId } = UpdateSubCategorySchema.parse(req.body);
  const data: { name?: string; categoryId?: string } = {};
  if (name !== undefined) data.name = name;
  if (categoryId !== undefined) data.categoryId = categoryId;
  const subCategory = await prisma.subCategory.update({ where: { id }, data });
  res.json(subCategory);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const id = req.params["id"] as string;
  await prisma.subCategory.delete({ where: { id } });
  res.status(204).send();
}));

export default router;
