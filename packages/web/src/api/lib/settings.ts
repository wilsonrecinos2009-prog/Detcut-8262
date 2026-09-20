import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";

export const DEFAULTS = {
  /** Confianza mínima para considerar un resultado concluyente. */
  confidence_threshold: "0.6",
  /** Objetivo de fiabilidad del sistema mostrado en el panel de validación. */
  accuracy_target: "0.8",
  /** Nombre de la institución impreso en los reportes. */
  clinic_name: "DET-Cut IA — Unidad de Dermatología Asistida",
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.select().from(schema.settings);
  const out = { ...DEFAULTS } as Record<SettingKey, string>;
  for (const row of rows) {
    if (row.key in out) out[row.key as SettingKey] = row.value;
  }
  return out;
}

export async function getThreshold(): Promise<number> {
  const s = await getSettings();
  const n = Number(s.confidence_threshold);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.6;
}

export async function setSetting(key: SettingKey, value: string) {
  const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  if (existing.length > 0) {
    await db
      .update(schema.settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value });
  }
}

export async function logAudit(actor: string, action: string, target?: string, detail?: string) {
  await db.insert(schema.auditLog).values({ actor, action, target, detail });
}

export function scanCode() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SC-${stamp}-${rand}`;
}
