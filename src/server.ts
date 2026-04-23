import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";

const app = express();

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL!,
});

const prisma = new PrismaClient({ adapter });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Muitas requisições vindas deste IP, tente novamente mais tarde."
});
app.use("/api/", limiter);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Apenas imagens são permitidas"));
  }
});

const __dirname = path.resolve();
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.use("/uploads", express.static(path.join(publicPath, "uploads")));

// --- ROTAS ---

// CATEGORIAS
app.get("/api/categories", async (req, res) => {
  const categories = await prisma.category.findMany({ include: { subCategories: true } });
  res.json(categories);
});

app.post("/api/categories", upload.single("photo"), async (req, res) => {
  try {
    const { name } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
    const category = await prisma.category.create({ data: { name, imageUrl } });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar categoria" });
  }
});

app.put("/api/categories/:id", upload.single("photo"), async (req, res) => {
  try {
    const { name } = req.body;
    const updateData: any = { name };
    if (req.file) updateData.imageUrl = `/uploads/${req.file.filename}`;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar categoria" });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Erro ao excluir categoria" });
  }
});

// SUBCATEGORIAS
app.get("/api/subcategories", async (req, res) => {
  const subcategories = await prisma.subCategory.findMany({ include: { category: true } });
  res.json(subcategories);
});

app.get("/api/categories/:id/subcategories", async (req, res) => {
  try {
    const subcategories = await prisma.subCategory.findMany({
      where: { categoryId: req.params.id },
    });
    res.json(subcategories);
  } catch (error) {
    res.status(400).json({ error: "Erro ao buscar subcategorias" });
  }
});

app.post("/api/subcategories", async (req, res) => {
  try {
    const { name, categoryId } = req.body;
    const subCategory = await prisma.subCategory.create({ data: { name, categoryId } });
    res.status(201).json(subCategory);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar subcategoria" });
  }
});

app.delete("/api/subcategories/:id", async (req, res) => {
  try {
    await prisma.subCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Erro ao excluir subcategoria" });
  }
});

// PRODUTOS
app.get("/api/products", async (req, res) => {
  const products = await prisma.product.findMany({ include: { subCategory: true } });
  res.json(products);
});

app.post("/api/products", upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, price, stock, subCategoryId, is_featured, on_sale, brand, model, voltage } = req.body;
    const files = req.files as Express.Multer.File[];
    const imageUrls = files ? files.map(file => `/uploads/${file.filename}`) : [];

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
        subCategoryId: subCategoryId || null,
        is_featured: is_featured === 'true' || is_featured === true,
        on_sale: on_sale === 'true' || on_sale === true,
        brand,
        model,
        voltage,
        images: imageUrls,
      },
    });
    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
});

app.put("/api/products/:id", upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, price, stock, subCategoryId, is_featured, on_sale, brand, model, voltage } = req.body;
    const files = req.files as Express.Multer.File[];

    const updateData: any = {
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      subCategoryId: subCategoryId || null,
      is_featured: is_featured === 'true' || is_featured === true,
      on_sale: on_sale === 'true' || on_sale === true,
      brand,
      model,
      voltage,
    };

    if (files && files.length > 0) {
      updateData.images = files.map(file => `/uploads/${file.filename}`);
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar produto" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Erro ao excluir produto" });
  }
});

// PEDIDOS
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customer, total, status, payment, address, items } = req.body;
    const order = await prisma.order.create({
      data: {
        customer,
        total: parseFloat(total),
        status: status || "Pendente",
        payment: payment || "Não informado",
        address: address || null,
        items: items || [],
      },
    });
    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

app.put("/api/orders/:id", async (req, res) => {
  try {
    const { status, payment } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, payment },
    });
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar pedido" });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Erro ao excluir pedido" });
  }
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor pronto na porta ${PORT}`);
});