import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { analyzeImage, NotSkinError } from "../analysis/engine";
import { getObjectBytes } from "./s3";
import { getThreshold, scanCode } from "./settings";

export type CreateScanInput = {
  imageKey: string;
  userId: string | null;
  patientId?: number | null;
  lesionId?: number | null;
  patientRef?: string | null;
  bodySite?: string | null;
  notes?: string | null;
  source: "web" | "camara" | "dispositivo";
  deviceId?: number | null;
};

/**
 * Analiza una imagen ya almacenada y persiste el escaneo.
 * Es el único camino de creación de escaneos: lo usan el panel web y la ingesta del ESP32-CAM.
 */
export async function runScan(input: CreateScanInput) {
  const { bytes, contentType } = await getObjectBytes(input.imageKey);
  const threshold = await getThreshold();

  let result;
  try {
    result = await analyzeImage(bytes, contentType, {
      bodySite: input.bodySite,
      notes: input.notes,
      threshold,
    });
  } catch (err) {
    if (err instanceof NotSkinError) throw err;
    throw err;
  }

  let patientRef = input.patientRef ?? null;
  if (input.patientId && !patientRef) {
    const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, input.patientId));
    patientRef = p?.ref ?? null;
  }

  const [scan] = await db
    .insert(schema.scans)
    .values({
      code: scanCode(),
      userId: input.userId,
      patientId: input.patientId ?? null,
      lesionId: input.lesionId ?? null,
      patientRef,
      imageKey: input.imageKey,
      source: input.source,
      deviceId: input.deviceId ?? null,
      bodySite: input.bodySite ?? null,
      diagnosis: result.diagnosis,
      diagnosisCode: result.diagnosisCode,
      confidence: result.confidence,
      isHealthy: result.isHealthy,
      conclusive: result.conclusive,
      triage: result.triage,
      malignancyRisk: result.malignancyRisk,
      qualityScore: result.qualityScore,
      qualityIssues: result.qualityIssues,
      probabilities: result.probabilities,
      abcde: result.abcde as Record<string, unknown>,
      findings: result.findings,
      recommendation: result.recommendation,
      differentials: result.differentials,
      modelVotes: result.modelVotes,
      agreement: result.agreement,
      engineVersion: result.engineVersion,
      latencyMs: result.latencyMs,
      reviewStatus: "pendiente",
    })
    .returning();

  return scan!;
}
