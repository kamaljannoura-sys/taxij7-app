import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, signToken } from "../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Numéro et mot de passe requis" });
  }
  const { phone, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { driverProfile: true },
  });
  if (!user) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  const token = signToken({ id: user.id, role: user.role, name: user.name });
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      driverProfile: user.driverProfile,
    },
  });
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(4).max(100).optional(),
});

// Changer son propre nom et/ou mot de passe (dispatcher ou chauffeur)
authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success || (!parsed.data.name && !parsed.data.password)) {
    return res.status(400).json({ error: "Rien à mettre à jour" });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.password ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) } : {}),
    },
    include: { driverProfile: true },
  });

  const token = signToken({ id: user.id, role: user.role, name: user.name });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      driverProfile: user.driverProfile,
    },
  });
});
