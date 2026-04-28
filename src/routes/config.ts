import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { z } from "zod";

const router = Router();

const BannerSchema = z.object({
  image: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  link: z.string().optional(),
});

const BenefitSchema = z.object({
  icon: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

const ConfigSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  fontFamily: z.string().optional(),
  bannerText: z.string().optional(),
  bannerEnabled: z.boolean().optional(),
  banners: z.array(BannerSchema).optional(),
  storeName: z.string().optional(),
  instagramUrl: z.string().optional(),
  whatsappUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  footerText: z.string().optional(),
  benefits: z.array(BenefitSchema).optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
});

router.get("/", asyncHandler(async (_req, res) => {
  let config = await prisma.storeConfig.findFirst();
  
  if (!config) {
    config = await prisma.storeConfig.create({
      data: {
        config: {
          primaryColor: "#0066cc",
          secondaryColor: "#ffffff",
          accentColor: "#ff6600",
          logo: "",
          fontFamily: "Inter, sans-serif",
          bannerText: "",
          bannerEnabled: false,
        },
      },
    });
  }
  
  res.json(config);
}));

router.post("/", asyncHandler(async (req, res) => {
  const parsed = ConfigSchema.parse(req.body);
  
  let config = await prisma.storeConfig.findFirst();
  
  if (config) {
    const currentConfig = config.config as Record<string, any>;
    const updatedConfig = { ...currentConfig, ...parsed };
    
    config = await prisma.storeConfig.update({
      where: { id: config.id },
      data: { config: updatedConfig },
    });
  } else {
    config = await prisma.storeConfig.create({
      data: {
        config: {
          primaryColor: parsed.primaryColor || "#0066cc",
          secondaryColor: parsed.secondaryColor || "#ffffff",
          accentColor: parsed.accentColor || "#ff6600",
          logo: parsed.logo || "",
          fontFamily: parsed.fontFamily || "Inter, sans-serif",
          bannerText: parsed.bannerText || "",
          bannerEnabled: parsed.bannerEnabled || false,
        },
      },
    });
  }
  
  res.json(config);
}));

export default router;
