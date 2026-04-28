import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

const RegisterSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Register new customer
router.post("/register", asyncHandler(async (req, res) => {
  const parsed = RegisterSchema.parse(req.body);
  
  // Check if email already exists
  const existingCustomer = await prisma.customer.findUnique({
    where: { email: parsed.email }
  });
  
  if (existingCustomer) {
    res.status(400).json({ error: "E-mail já cadastrado" });
    return;
  }

  // Check if CPF already exists (if provided)
  if (parsed.cpf) {
    const existingCpf = await prisma.customer.findUnique({
      where: { cpf: parsed.cpf }
    });

    if (existingCpf) {
      res.status(400).json({ error: "CPF já cadastrado" });
      return;
    }
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(parsed.password, 10);
  
  // Create customer (filter out undefined values)
  const customerData: any = {
    name: parsed.name,
    email: parsed.email,
    password: hashedPassword,
  };
  
  if (parsed.cpf) customerData.cpf = parsed.cpf;
  if (parsed.phone) customerData.phone = parsed.phone;
  if (parsed.address) customerData.address = parsed.address;
  
  const customer = await prisma.customer.create({
    data: customerData,
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      phone: true,
      address: true,
      createdAt: true,
    }
  });
  
  // Generate JWT token
  const token = jwt.sign(
    { customerId: customer.id, email: customer.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  res.status(201).json({
    customer,
    token,
    message: "Cadastro realizado com sucesso"
  });
}));

// Login customer
router.post("/login", asyncHandler(async (req, res) => {
  const parsed = LoginSchema.parse(req.body);
  
  // Find customer by email
  const customer = await prisma.customer.findUnique({
    where: { email: parsed.email }
  });
  
  if (!customer) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(parsed.password, customer.password);

  if (!isValidPassword) {
    res.status(401).json({ error: "Credenciais inválidas" });
    return;
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { customerId: customer.id, email: customer.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  
  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cpf: customer.cpf,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
    },
    token,
    message: "Login realizado com sucesso"
  });
}));

// Middleware to verify JWT token
export const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado" });
    }
    
    req.customer = decoded;
    next();
  });
};

// Get current customer info
router.get("/me", authenticateToken, asyncHandler(async (req: any, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.customer.customerId },
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true,
      phone: true,
      address: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  
  if (!customer) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }

  res.json(customer);
}));

export default router;
