import { z } from "zod";
import { desc, eq, gte } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { presignGet, putObject } from "../lib/s3";
import { runScan } from "../lib/scan-service";
import { NotSkinError } from "../analysis/engine";
import { CLASSES } from "../analysis/taxonomy";
import { getSettings, logAudit } from "../lib/settings";

async function withImage<T extends { imageKey: string }>(row: T) {
  return { ...row, imageUrl: await presignGet(row.imageKey, 3600) };
}

export const scans = {
  /** Catálogo de clases del motor (para la UI). */
  taxonomy: authed.handler(async () => {
    const settings = await getSettings();
    return { classes: CLASSES, threshold: Number(settings.confidence_threshold) };
  }),

  /** Analiza una imagen ya subida al almacenamiento. */
  analyze: authed
    .input(
      z.object({
        imageKey: z.string(),
        patientId: z.number().nullish(),
        lesionId: z.number().nullish(),
        patientRef: z.string().nullish(),
        bodySite: z.string().nullish(),
        notes: z.string().nullish(),
        source: z.enum(["web", "camara"]).default("web"),
      }),
    )
    .handler(async ({ input, context }) => {
      try {
        const scan = await runScan({ ...input, userId: context.user.id, source: input.source });
        await logAudit(context.user.email, "escaneo.analizar", scan.code, scan.diagnosis);
        return withImage(scan);
      } catch (err) {
        if (err instanceof NotSkinError) throw new ORPCError("BAD_REQUEST", { message: err.message });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: err instanceof Error ? err.message : "Error de análisis",
        });
      }
    }),

  /** Sube una captura en base64 (cámara en vivo) y la analiza. */
  analyzeBase64: authed
    .input(
      z.object({
        dataUrl: z.string(),
        patientId: z.number().nullish(),
        lesionId: z.number().nullish(),
        patientRef: z.string().nullish(),
        bodySite: z.string().nullish(),
        notes: z.string().nullish(),
      }),
    )
    .handler(async ({ input, context }) => {
      const match = input.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) throw new ORPCError("BAD_REQUEST", { message: "Formato de imagen inválido" });
      const contentType = match[1]!;
      const bytes = Buffer.from(match[2]!, "base64");
      const key = `escaneos/camara-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      await putObject(key, new Uint8Array(bytes), contentType);
      try {
        const scan = await runScan({
          imageKey: key,
          userId: context.user.id,
          patientId: input.patientId,
          lesionId: input.lesionId,
          patientRef: input.patientRef,
          bodySite: input.bodySite,
          notes: input.notes,
          source: "camara",
        });
        await logAudit(context.user.email, "escaneo.camara", scan.code, scan.diagnosis);
        return withImage(scan);
      } catch (err) {
        if (err instanceof NotSkinError) throw new ORPCError("BAD_REQUEST", { message: err.message });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: err instanceof Error ? err.message : "Error de análisis",
        });
      }
    }),

  list: authed
    .input(
      z
        .object({
          triage: z.string().optional(),
          source: z.string().optional(),
          limit: z.number().default(200),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      const rows = await db
        .select()
        .from(schema.scans)
        .orderBy(desc(schema.scans.createdAt))
        .limit(input?.limit ?? 200);
      const filtered = rows.filter(
        (r) =>
          (!input?.triage || input.triage === "todos" || r.triage === input.triage) &&
          (!input?.source || input.source === "todos" || r.source === input.source),
      );
      return Promise.all(filtered.map(withImage));
    }),

  get: authed.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    const [scan] = await db.select().from(schema.scans).where(eq(schema.scans.id, input.id));
    if (!scan) throw new ORPCError("NOT_FOUND", { message: "Escaneo no encontrado" });
    const patient = scan.patientId
      ? (await db.select().from(schema.patients).where(eq(schema.patients.id, scan.patientId)))[0] ?? null
      : null;
    const settings = await getSettings();
    return { scan: await withImage(scan), patient, clinicName: settings.clinic_name };
  }),

  /** Escaneos recientes provenientes de dispositivos, para el panel en vivo. */
  pending: authed.handler(async () => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 12);
    const rows = await db
      .select()
      .from(schema.scans)
      .where(gte(schema.scans.createdAt, since))
      .orderBy(desc(schema.scans.createdAt))
      .limit(20);
    return Promise.all(rows.filter((r) => r.source === "dispositivo").map(withImage));
  }),

  /** Validación del médico sobre el resultado del motor. */
  review: authed
    .input(
      z.object({
        id: z.number(),
        reviewStatus: z.enum(["confirmado", "corregido", "descartado"]),
        reviewNote: z.string().nullish(),
        correctedDiagnosis: z.string().nullish(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [scan] = await db
        .update(schema.scans)
        .set({
          reviewStatus: input.reviewStatus,
          reviewNote: input.reviewNote ?? null,
          reviewedBy: context.user.email,
          reviewedAt: new Date(),
          ...(input.correctedDiagnosis ? { diagnosis: input.correctedDiagnosis } : {}),
        })
        .where(eq(schema.scans.id, input.id))
        .returning();
      await logAudit(context.user.email, `escaneo.${input.reviewStatus}`, scan!.code, input.reviewNote ?? "");
      return scan!;
    }),

  remove: authed.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(schema.scans).where(eq(schema.scans.id, input.id));
    await logAudit(context.user.email, "escaneo.eliminar", String(input.id));
    return { ok: true };
  }),

  /** Métricas del panel principal. */
  dashboard: authed.handler(async () => {
    const rows = await db.select().from(schema.scans).orderBy(desc(schema.scans.createdAt));
    const last30 = rows.filter((r) => +r.createdAt > Date.now() - 30 * 864e5);
    const [lastRun] = await db
      .select()
      .from(schema.validationRuns)
      .orderBy(desc(schema.validationRuns.createdAt))
      .limit(1);
    const deviceRows = await db.select().from(schema.devices);
    const patientCount = (await db.select().from(schema.patients)).length;

    const byDay = new Map<string, number>();
    for (const r of last30) {
      const k = r.createdAt.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }

    return {
      total: rows.length,
      last30: last30.length,
      healthy: rows.filter((r) => r.isHealthy).length,
      red: rows.filter((r) => r.triage === "rojo").length,
      amber: rows.filter((r) => r.triage === "ambar").length,
      inconclusive: rows.filter((r) => !r.conclusive).length,
      pendingReview: rows.filter((r) => r.reviewStatus === "pendiente").length,
      patients: patientCount,
      devices: deviceRows.filter((d) => d.active).length,
      devicesOnline: deviceRows.filter((d) => d.lastSeenAt && +d.lastSeenAt > Date.now() - 5 * 60_000).length,
      accuracy: lastRun?.accuracy ?? null,
      accuracyRunAt: lastRun?.createdAt ?? null,
      avgConfidence: rows.length ? rows.reduce((s, r) => s + r.confidence, 0) / rows.length : 0,
      series: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      recent: await Promise.all(rows.slice(0, 8).map(withImage)),
    };
  }),

  /** Exportación CSV del historial. */
  exportCsv: authed
    .input(z.object({ from: z.string().nullish(), to: z.string().nullish() }).optional())
    .handler(async ({ input }) => {
      const rows = await db.select().from(schema.scans).orderBy(desc(schema.scans.createdAt));
      const from = input?.from ? new Date(input.from) : null;
      const to = input?.to ? new Date(input.to) : null;
      const filtered = rows.filter(
        (r) => (!from || r.createdAt >= from) && (!to || r.createdAt <= new Date(+to + 864e5)),
      );
      const headers = [
        "codigo",
        "fecha",
        "paciente_ref",
        "zona",
        "origen",
        "diagnostico",
        "codigo_clase",
        "confianza",
        "concluyente",
        "piel_sana",
        "triaje",
        "riesgo_malignidad",
        "calidad_imagen",
        "concordancia_panel",
        "revision",
        "revisado_por",
        "motor",
      ];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = filtered.map((r) =>
        [
          r.code,
          r.createdAt.toISOString(),
          r.patientRef ?? "",
          r.bodySite ?? "",
          r.source,
          r.diagnosis,
          r.diagnosisCode,
          (r.confidence * 100).toFixed(1),
          r.conclusive ? "si" : "no",
          r.isHealthy ? "si" : "no",
          r.triage,
          (r.malignancyRisk * 100).toFixed(1),
          (r.qualityScore * 100).toFixed(0),
          (r.agreement * 100).toFixed(0),
          r.reviewStatus ?? "",
          r.reviewedBy ?? "",
          r.engineVersion,
        ]
          .map(esc)
          .join(","),
      );
      return { csv: [headers.join(","), ...lines].join("\n"), count: filtered.length };
    }),
};
