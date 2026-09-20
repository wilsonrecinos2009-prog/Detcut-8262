import { generateObject } from "ai";
import { z } from "zod";
import { gateway } from "./gateway";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";
import {
  CLASSES,
  CLASS_CODES,
  HEALTHY,
  MALIGNANT_CODES,
  PREMALIGNANT_CODES,
  byCode,
  labelOf,
  type Triage,
} from "./taxonomy";

export const ENGINE_VERSION = "1.2.0";

/** Panel de lectores. Se consultan 2 en paralelo y un tercero desempata si discrepan. */
const PANEL = ["anthropic/claude-sonnet-4.6", "google/gemini-3.1-pro-preview"] as const;
const TIEBREAKER = "openai/gpt-5.4";

const probabilityShape = Object.fromEntries(
  CLASS_CODES.map((code) => [code, z.number().min(0).max(1)]),
) as Record<string, z.ZodNumber>;

const readingSchema = z.object({
  es_piel: z.boolean().describe("¿La imagen muestra piel humana evaluable?"),
  calidad: z.object({
    nitidez: z.number().min(0).max(1),
    iluminacion: z.number().min(0).max(1),
    encuadre: z.number().min(0).max(1),
    problemas: z.array(z.string()).describe("Problemas de captura detectados, en español"),
  }),
  probabilidades: z.object(probabilityShape).describe("Probabilidad por clase, suman ~1.0"),
  hallazgos: z.string().describe("Descripción objetiva de lo observado, 1-3 frases"),
  abcde: z.object({
    aplica: z.boolean(),
    asimetria: z.boolean(),
    bordes_irregulares: z.boolean(),
    color_heterogeneo: z.boolean(),
    diametro_mayor_6mm: z.boolean(),
    evolucion_o_elevacion: z.boolean(),
    nota: z.string(),
  }),
  diagnosticos_diferenciales: z.array(z.string()).max(4),
  certeza_propia: z.number().min(0).max(1).describe("Qué tan seguro estás de tu lectura"),
});

export type Reading = z.infer<typeof readingSchema> & { model: string };

export type EngineOptions = {
  bodySite?: string | null;
  notes?: string | null;
  /** Umbral mínimo de confianza para dar un resultado concluyente. */
  threshold?: number;
  /** Panel reducido (1 lector) para corridas masivas de validación. */
  fast?: boolean;
};

export type EngineResult = {
  diagnosisCode: string;
  diagnosis: string;
  confidence: number;
  conclusive: boolean;
  isHealthy: boolean;
  triage: Triage;
  malignancyRisk: number;
  probabilities: Record<string, number>;
  qualityScore: number;
  qualityIssues: string[];
  findings: string;
  recommendation: string;
  differentials: string[];
  abcde: Record<string, unknown>;
  agreement: number;
  modelVotes: { model: string; top: string; confidence: number; certainty: number }[];
  engineVersion: string;
  latencyMs: number;
};

export class NotSkinError extends Error {}

function normalize(p: Record<string, number>): Record<string, number> {
  const clean: Record<string, number> = {};
  let sum = 0;
  for (const code of CLASS_CODES) {
    const v = Math.max(0, Number(p[code] ?? 0));
    clean[code] = v;
    sum += v;
  }
  if (sum <= 0) return Object.fromEntries(CLASS_CODES.map((c) => [c, 1 / CLASS_CODES.length]));
  for (const code of CLASS_CODES) clean[code] = clean[code]! / sum;
  return clean;
}

function topOf(p: Record<string, number>) {
  return CLASS_CODES.reduce((best, code) => (p[code]! > p[best]! ? code : best), CLASS_CODES[0]!);
}

async function readOnce(
  model: string,
  image: Uint8Array,
  mediaType: string,
  opts: EngineOptions,
  pass: number,
): Promise<Reading | null> {
  try {
    const { object } = await generateObject({
      model: gateway(model),
      schema: readingSchema,
      system: SYSTEM_PROMPT,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt({ bodySite: opts.bodySite, notes: opts.notes, pass }) },
            { type: "image", image, mediaType },
          ],
        },
      ],
    });
    return { ...object, model };
  } catch (err) {
    console.error(`[engine] lectura fallida (${model}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Motor de consenso: varias lecturas independientes, promedio ponderado por la certeza
 * de cada lector, y umbral de confianza. Si el panel no coincide o la confianza es baja,
 * el resultado se marca NO CONCLUYENTE en lugar de arriesgar un diagnóstico.
 */
export async function analyzeImage(
  image: Uint8Array,
  mediaType: string,
  opts: EngineOptions = {},
): Promise<EngineResult> {
  const started = Date.now();
  const threshold = opts.threshold ?? 0.6;

  const models = opts.fast ? [PANEL[0]] : [...PANEL];
  let readings = (await Promise.all(models.map((m, i) => readOnce(m, image, mediaType, opts, i + 1)))).filter(
    (r): r is Reading => r !== null,
  );

  if (readings.length === 0) throw new Error("El motor de análisis no está disponible en este momento.");

  const notSkinVotes = readings.filter((r) => !r.es_piel).length;
  if (notSkinVotes > readings.length / 2) {
    throw new NotSkinError("La imagen no corresponde a piel humana evaluable. Repita la captura.");
  }

  // Desempate: si los dos lectores discrepan en la clase principal, se consulta un tercero.
  let tops = readings.map((r) => topOf(normalize(r.probabilidades)));
  if (!opts.fast && readings.length > 1 && new Set(tops).size > 1) {
    const extra = await readOnce(TIEBREAKER, image, mediaType, opts, 3);
    if (extra) {
      readings = [...readings, extra];
      tops = readings.map((r) => topOf(normalize(r.probabilidades)));
    }
  }

  // Promedio ponderado por certeza declarada y por calidad de imagen percibida.
  const avg: Record<string, number> = Object.fromEntries(CLASS_CODES.map((c) => [c, 0]));
  let weightSum = 0;
  for (const r of readings) {
    const p = normalize(r.probabilidades);
    const w = 0.5 + 0.5 * r.certeza_propia;
    weightSum += w;
    for (const code of CLASS_CODES) avg[code] = avg[code]! + p[code]! * w;
  }
  for (const code of CLASS_CODES) avg[code] = avg[code]! / weightSum;

  const top = topOf(avg);
  const def = byCode(top)!;

  // Concordancia del panel sobre la clase ganadora.
  const agreement = tops.filter((t) => t === top).length / tops.length;

  const qualityScore =
    readings.reduce((s, r) => s + (r.calidad.nitidez + r.calidad.iluminacion + r.calidad.encuadre) / 3, 0) /
    readings.length;
  const qualityIssues = [...new Set(readings.flatMap((r) => r.calidad.problemas))].slice(0, 6);

  // Confianza calibrada: probabilidad de la clase ganadora, penalizada por desacuerdo
  // del panel y por mala calidad de imagen.
  const qualityPenalty = qualityScore < 0.45 ? 0.75 : qualityScore < 0.65 ? 0.9 : 1;
  const confidence = Math.min(0.99, avg[top]! * (0.7 + 0.3 * agreement) * qualityPenalty);

  const malignancyRisk = CLASSES.reduce((s, c) => s + avg[c.code]! * c.malignancyWeight, 0);
  const conclusive = confidence >= threshold && qualityScore >= 0.35;

  // Triaje conservador: el riesgo acumulado de malignidad manda sobre la clase ganadora,
  // y un resultado no concluyente nunca se cierra en verde.
  let triage: Triage = def.baseTriage;
  if (malignancyRisk >= 0.4 || MALIGNANT_CODES.includes(top)) triage = "rojo";
  else if (malignancyRisk >= 0.15 || PREMALIGNANT_CODES.includes(top)) triage = "ambar";
  if (!conclusive && triage === "verde") triage = "ambar";

  const isHealthy = top === HEALTHY && conclusive && malignancyRisk < 0.1;

  const bestFindings =
    readings.slice().sort((a, b) => b.certeza_propia - a.certeza_propia)[0] ?? readings[0]!;

  const recommendation = !conclusive
    ? "Resultado NO CONCLUYENTE: la confianza del motor está por debajo del umbral clínico. Repita la captura con mejor iluminación y enfoque, o derive a valoración dermatológica presencial."
    : def.recommendation;

  return {
    diagnosisCode: conclusive ? top : "no_concluyente",
    diagnosis: conclusive ? labelOf(top) : "No concluyente",
    confidence,
    conclusive,
    isHealthy,
    triage,
    malignancyRisk,
    probabilities: avg,
    qualityScore,
    qualityIssues,
    findings: bestFindings.hallazgos,
    recommendation,
    differentials: [...new Set(readings.flatMap((r) => r.diagnosticos_diferenciales))].slice(0, 5),
    abcde: bestFindings.abcde,
    agreement,
    modelVotes: readings.map((r) => {
      const p = normalize(r.probabilidades);
      const t = topOf(p);
      return { model: r.model, top: labelOf(t), confidence: p[t]!, certainty: r.certeza_propia };
    }),
    engineVersion: ENGINE_VERSION,
    latencyMs: Date.now() - started,
  };
}
