import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

/** Pacientes atendidos en la clínica. */
export const patients = sqliteTable(
  "patients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ref: text("ref").notNull().unique(),
    fullName: text("full_name").notNull(),
    birthDate: text("birth_date"),
    sex: text("sex"),
    phototype: text("phototype"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("patients_created_by_idx").on(t.createdBy)],
);

/** Lesión concreta de un paciente, seguida en el tiempo. */
export const lesions = sqliteTable(
  "lesions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    patientId: integer("patient_id").notNull(),
    label: text("label").notNull(),
    bodySite: text("body_site"),
    status: text("status").notNull().default("en_seguimiento"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("lesions_patient_idx").on(t.patientId)],
);

/** Cada análisis de imagen realizado por el motor. */
export const scans = sqliteTable(
  "scans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    userId: text("user_id"),
    patientId: integer("patient_id"),
    lesionId: integer("lesion_id"),
    patientRef: text("patient_ref"),
    imageKey: text("image_key").notNull(),
    source: text("source").notNull().default("web"),
    deviceId: integer("device_id"),
    bodySite: text("body_site"),

    status: text("status").notNull().default("completado"),
    diagnosis: text("diagnosis").notNull(),
    diagnosisCode: text("diagnosis_code").notNull(),
    confidence: real("confidence").notNull(),
    isHealthy: integer("is_healthy", { mode: "boolean" }).notNull().default(false),
    conclusive: integer("conclusive", { mode: "boolean" }).notNull().default(true),
    triage: text("triage").notNull().default("verde"),
    malignancyRisk: real("malignancy_risk").notNull().default(0),

    qualityScore: real("quality_score").notNull().default(0),
    qualityIssues: text("quality_issues", { mode: "json" }).$type<string[]>(),
    probabilities: text("probabilities", { mode: "json" }).$type<Record<string, number>>(),
    abcde: text("abcde", { mode: "json" }).$type<Record<string, unknown>>(),
    findings: text("findings"),
    recommendation: text("recommendation"),
    differentials: text("differentials", { mode: "json" }).$type<string[]>(),
    modelVotes: text("model_votes", { mode: "json" }).$type<unknown[]>(),
    agreement: real("agreement").notNull().default(0),
    engineVersion: text("engine_version").notNull().default("1.0.0"),
    latencyMs: integer("latency_ms").notNull().default(0),

    reviewedBy: text("reviewed_by"),
    reviewStatus: text("review_status"),
    reviewNote: text("review_note"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("scans_user_idx").on(t.userId),
    index("scans_patient_idx").on(t.patientId),
    index("scans_lesion_idx").on(t.lesionId),
    index("scans_created_idx").on(t.createdAt),
  ],
);

/** Dispositivos de captura (ESP32-CAM u otros) autorizados a enviar imágenes. */
export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  ownerId: text("owner_id").notNull(),
  location: text("location"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  captureCount: integer("capture_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Set de prueba etiquetado para medir la fiabilidad del motor. */
export const testCases = sqliteTable("test_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageKey: text("image_key").notNull(),
  sourceUrl: text("source_url"),
  trueLabel: text("true_label").notNull(),
  dataset: text("dataset").notNull().default("interno"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Ejecución del set de prueba: una fila por corrida de validación. */
export const validationRuns = sqliteTable("validation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runBy: text("run_by").notNull(),
  engineVersion: text("engine_version").notNull(),
  threshold: real("threshold").notNull(),
  total: integer("total").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  healthyRecall: real("healthy_recall").notNull().default(0),
  malignantRecall: real("malignant_recall").notNull().default(0),
  confusion: text("confusion", { mode: "json" }).$type<Record<string, Record<string, number>>>(),
  perClass: text("per_class", { mode: "json" }).$type<unknown[]>(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Resultado individual dentro de una corrida de validación. */
export const validationResults = sqliteTable(
  "validation_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id").notNull(),
    testCaseId: integer("test_case_id").notNull(),
    trueLabel: text("true_label").notNull(),
    predicted: text("predicted").notNull(),
    confidence: real("confidence").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
  },
  (t) => [index("validation_results_run_idx").on(t.runId)],
);

/** Parámetros del motor ajustables por el administrador. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Bitácora de auditoría (uso clínico: quién hizo qué). */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    target: text("target"),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
