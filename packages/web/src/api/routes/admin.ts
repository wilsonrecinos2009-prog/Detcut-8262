import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authed, adminOnly } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { DEFAULTS, getSettings, logAudit, setSetting } from "../lib/settings";

export const admin = {
  /** Cualquier usuario autenticado puede leer los ajustes visibles (umbral, objetivo, clínica). */
  settings: authed.handler(async () => getSettings()),

  /** El primer usuario registrado se convierte en administrador automáticamente. */
  me: authed.handler(async ({ context }) => {
    const users = await db.select().from(schema.user).orderBy(schema.user.createdAt);
    const isFirst = users[0]?.id === context.user.id;
    let role = (context.user.role as string | null) ?? "medico";
    if (isFirst && role !== "admin") {
      await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, context.user.id));
      role = "admin";
    }
    return { ...context.user, role };
  }),

  users: adminOnly.handler(async () => {
    const rows = await db.select().from(schema.user).orderBy(desc(schema.user.createdAt));
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role ?? "medico",
      licenseId: u.licenseId,
      createdAt: u.createdAt,
    }));
  }),

  setRole: adminOnly
    .input(z.object({ userId: z.string(), role: z.enum(["medico", "admin"]) }))
    .handler(async ({ input, context }) => {
      await db.update(schema.user).set({ role: input.role }).where(eq(schema.user.id, input.userId));
      await logAudit(context.user.email, "usuario.rol", input.userId, input.role);
      return { ok: true };
    }),

  updateSettings: adminOnly
    .input(
      z.object({
        confidence_threshold: z.string().optional(),
        accuracy_target: z.string().optional(),
        clinic_name: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      for (const key of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
        const value = input[key];
        if (value !== undefined) await setSetting(key, value);
      }
      await logAudit(context.user.email, "ajustes.actualizar", "", JSON.stringify(input));
      return getSettings();
    }),

  audit: adminOnly.handler(async () => {
    return db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(150);
  }),
};
