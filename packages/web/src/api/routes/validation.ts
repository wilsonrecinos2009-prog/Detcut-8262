import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { getObjectBytes, presignGet, presignPut, putObject } from "../lib/s3";
import { analyzeImage, ENGINE_VERSION, NotSkinError } from "../analysis/engine";
import { CLASSES, CLASS_CODES, HEALTHY, MALIGNANT_CODES, labelOf } from "../analysis/taxonomy";
import { getThreshold, logAudit } from "../lib/settings";

/**
 * Módulo de fiabilidad: corre el motor sobre un set de imágenes etiquetadas y
 * calcula accuracy, sensibilidad/especificidad por clase y matriz de confusión.
 * Es lo que respalda la cifra de fiabilidad que muestra el sistema — no una promesa.
 */
export const validation = {
  cases: authed.handler(async () => {
    const rows = await db.select().from(schema.testCases).orderBy(desc(schema.testCases.createdAt));
    return Promise.all(rows.map(async (c) => ({ ...c, imageUrl: await presignGet(c.imageKey, 3600) })));
  }),

  presignCase: authed
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .handler(async ({ input }) => {
      const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const key = `validacion/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      return { url: await presignPut(key, input.contentType), key };
    }),

  addCase: authed
    .input(
      z.object({
        imageKey: z.string(),
        trueLabel: z.enum(CLASS_CODES as [string, ...string[]]),
        dataset: z.string().default("interno"),
        notes: z.string().nullish(),
      }),
    )
    .handler(async ({ input, context }) => {
      const [row] = await db.insert(schema.testCases).values(input).returning();
      await logAudit(context.user.email, "validacion.caso_agregado", String(row!.id), input.trueLabel);
      return row!;
    }),

  /** Alta de un caso desde una URL pública (p. ej. imágenes ISIC/DermNet). */
  addCaseFromUrl: authed
    .input(
      z.object({
        url: z.string().url(),
        trueLabel: z.enum(CLASS_CODES as [string, ...string[]]),
        dataset: z.string().default("externo"),
        notes: z.string().nullish(),
      }),
    )
    .handler(async ({ input }) => {
      const res = await fetch(input.url);
      if (!res.ok) throw new ORPCError("BAD_REQUEST", { message: "No se pudo descargar la imagen" });
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image/")) {
        throw new ORPCError("BAD_REQUEST", { message: "La URL no apunta a una imagen" });
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const key = `validacion/url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await putObject(key, bytes, contentType);
      const [row] = await db
        .insert(schema.testCases)
        .values({ imageKey: key, sourceUrl: input.url, trueLabel: input.trueLabel, dataset: input.dataset, notes: input.notes })
        .returning();
      return row!;
    }),

  removeCase: authed.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    await db.delete(schema.testCases).where(eq(schema.testCases.id, input.id));
    return { ok: true };
  }),

  runs: authed.handler(async () => {
    return db.select().from(schema.validationRuns).orderBy(desc(schema.validationRuns.createdAt)).limit(20);
  }),

  run: authed.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    const [run] = await db.select().from(schema.validationRuns).where(eq(schema.validationRuns.id, input.id));
    if (!run) throw new ORPCError("NOT_FOUND", { message: "Corrida no encontrada" });
    const results = await db
      .select()
      .from(schema.validationResults)
      .where(eq(schema.validationResults.runId, input.id));
    return { run, results };
  }),

  /** Ejecuta el set de prueba completo (o un subconjunto) y guarda las métricas. */
  execute: authed
    .input(z.object({ limit: z.number().min(1).max(40).default(20) }).optional())
    .handler(async ({ input, context }) => {
      const cases = await db.select().from(schema.testCases).orderBy(desc(schema.testCases.createdAt));
      if (cases.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No hay casos en el set de prueba. Agregue imágenes etiquetadas primero.",
        });
      }
      const subset = cases.slice(0, input?.limit ?? 20);
      const threshold = await getThreshold();

      const [run] = await db
        .insert(schema.validationRuns)
        .values({ runBy: context.user.email, engineVersion: ENGINE_VERSION, threshold, total: subset.length })
        .returning();

      const confusion: Record<string, Record<string, number>> = {};
      for (const c of CLASS_CODES) confusion[c] = Object.fromEntries(CLASS_CODES.map((k) => [k, 0]));

      let correct = 0;
      for (const testCase of subset) {
        let predicted = "error";
        let confidence = 0;
        try {
          const { bytes, contentType } = await getObjectBytes(testCase.imageKey);
          const result = await analyzeImage(bytes, contentType, { threshold, fast: true });
          predicted = result.conclusive ? result.diagnosisCode : topCode(result.probabilities);
          confidence = result.confidence;
        } catch (err) {
          if (!(err instanceof NotSkinError)) console.error("[validacion]", err);
        }
        const ok = predicted === testCase.trueLabel;
        if (ok) correct += 1;
        if (confusion[testCase.trueLabel]?.[predicted] !== undefined) {
          confusion[testCase.trueLabel]![predicted] = confusion[testCase.trueLabel]![predicted]! + 1;
        }
        await db.insert(schema.validationResults).values({
          runId: run!.id,
          testCaseId: testCase.id,
          trueLabel: testCase.trueLabel,
          predicted,
          confidence,
          correct: ok,
        });
      }

      const perClass = CLASSES.map((cls) => {
        const tp = confusion[cls.code]?.[cls.code] ?? 0;
        const support = CLASS_CODES.reduce((s, k) => s + (confusion[cls.code]?.[k] ?? 0), 0);
        const predictedTotal = CLASS_CODES.reduce((s, k) => s + (confusion[k]?.[cls.code] ?? 0), 0);
        const fp = predictedTotal - tp;
        const tn = subset.length - support - fp;
        return {
          code: cls.code,
          label: cls.label,
          support,
          recall: support ? tp / support : null,
          precision: predictedTotal ? tp / predictedTotal : null,
          specificity: tn + fp ? tn / (tn + fp) : null,
        };
      });

      const healthySupport = subset.filter((c) => c.trueLabel === HEALTHY).length;
      const healthyRecall = healthySupport ? (confusion[HEALTHY]?.[HEALTHY] ?? 0) / healthySupport : 0;
      const malignantSupport = subset.filter((c) => MALIGNANT_CODES.includes(c.trueLabel)).length;
      const malignantHits = MALIGNANT_CODES.reduce(
        (s, code) => s + MALIGNANT_CODES.reduce((x, k) => x + (confusion[code]?.[k] ?? 0), 0),
        0,
      );
      const malignantRecall = malignantSupport ? malignantHits / malignantSupport : 0;

      const [finished] = await db
        .update(schema.validationRuns)
        .set({
          correct,
          accuracy: subset.length ? correct / subset.length : 0,
          healthyRecall,
          malignantRecall,
          confusion,
          perClass,
          finishedAt: new Date(),
        })
        .where(eq(schema.validationRuns.id, run!.id))
        .returning();

      await logAudit(
        context.user.email,
        "validacion.ejecutar",
        String(run!.id),
        `accuracy=${((finished!.accuracy ?? 0) * 100).toFixed(1)}%`,
      );
      return finished!;
    }),

  /** Métricas operativas: coincidencia entre el motor y la revisión médica real. */
  fieldAgreement: authed.handler(async () => {
    const rows = await db.select().from(schema.scans);
    const reviewed = rows.filter((r) => r.reviewStatus && r.reviewStatus !== "pendiente");
    const confirmed = reviewed.filter((r) => r.reviewStatus === "confirmado").length;
    return {
      reviewed: reviewed.length,
      confirmed,
      agreement: reviewed.length ? confirmed / reviewed.length : null,
      healthyShare: rows.length ? rows.filter((r) => r.isHealthy).length / rows.length : 0,
      inconclusiveShare: rows.length ? rows.filter((r) => !r.conclusive).length / rows.length : 0,
    };
  }),

  classes: authed.handler(async () => CLASSES.map((c) => ({ code: c.code, label: c.label, nature: c.nature }))),
};

function topCode(p: Record<string, number>) {
  return CLASS_CODES.reduce((best, code) => ((p[code] ?? 0) > (p[best] ?? 0) ? code : best), CLASS_CODES[0]!);
}

export const _labelOf = labelOf;
