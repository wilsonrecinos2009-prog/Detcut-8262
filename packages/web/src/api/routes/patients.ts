import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { presignGet } from "../lib/s3";
import { logAudit } from "../lib/settings";

const patientInput = z.object({
  ref: z.string().min(2),
  fullName: z.string().min(2),
  birthDate: z.string().nullish(),
  sex: z.string().nullish(),
  phototype: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  notes: z.string().nullish(),
});

export const patients = {
  list: authed.input(z.object({ q: z.string().optional() }).optional()).handler(async ({ input }) => {
    const q = input?.q?.trim();
    const rows = q
      ? await db
          .select()
          .from(schema.patients)
          .where(
            or(like(schema.patients.fullName, `%${q}%`), like(schema.patients.ref, `%${q}%`)),
          )
          .orderBy(desc(schema.patients.createdAt))
      : await db.select().from(schema.patients).orderBy(desc(schema.patients.createdAt));

    const counts = await db.select().from(schema.scans);
    return rows.map((p) => {
      const own = counts.filter((s) => s.patientId === p.id);
      return {
        ...p,
        scanCount: own.length,
        redFlags: own.filter((s) => s.triage === "rojo").length,
        lastScanAt: own.length > 0 ? own.map((s) => s.createdAt).sort((a, b) => +b - +a)[0] : null,
      };
    });
  }),

  get: authed.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, input.id));
    if (!patient) throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });

    const lesions = await db
      .select()
      .from(schema.lesions)
      .where(eq(schema.lesions.patientId, input.id))
      .orderBy(desc(schema.lesions.createdAt));

    const scans = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.patientId, input.id))
      .orderBy(desc(schema.scans.createdAt));

    const withUrls = await Promise.all(
      scans.map(async (s) => ({ ...s, imageUrl: await presignGet(s.imageKey, 3600) })),
    );

    return { patient, lesions, scans: withUrls };
  }),

  create: authed.input(patientInput).handler(async ({ input, context }) => {
    const existing = await db.select().from(schema.patients).where(eq(schema.patients.ref, input.ref));
    if (existing.length > 0) throw new ORPCError("CONFLICT", { message: "Ya existe un paciente con esa referencia" });

    const [patient] = await db
      .insert(schema.patients)
      .values({ ...input, createdBy: context.user.id })
      .returning();
    await logAudit(context.user.email, "paciente.crear", patient!.ref);
    return patient!;
  }),

  update: authed
    .input(patientInput.partial().extend({ id: z.number() }))
    .handler(async ({ input, context }) => {
      const { id, ...rest } = input;
      const [patient] = await db
        .update(schema.patients)
        .set(rest)
        .where(eq(schema.patients.id, id))
        .returning();
      await logAudit(context.user.email, "paciente.editar", String(id));
      return patient!;
    }),

  createLesion: authed
    .input(
      z.object({
        patientId: z.number(),
        label: z.string().min(1),
        bodySite: z.string().nullish(),
      }),
    )
    .handler(async ({ input }) => {
      const [lesion] = await db.insert(schema.lesions).values(input).returning();
      return lesion!;
    }),

  updateLesionStatus: authed
    .input(z.object({ id: z.number(), status: z.enum(["en_seguimiento", "resuelta", "derivada"]) }))
    .handler(async ({ input }) => {
      const [lesion] = await db
        .update(schema.lesions)
        .set({ status: input.status })
        .where(eq(schema.lesions.id, input.id))
        .returning();
      return lesion!;
    }),

  /** Evolución temporal de una lesión: escaneos ordenados con su riesgo. */
  lesionTimeline: authed.input(z.object({ lesionId: z.number() })).handler(async ({ input }) => {
    const rows = await db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.lesionId, input.lesionId))
      .orderBy(schema.scans.createdAt);
    return Promise.all(rows.map(async (s) => ({ ...s, imageUrl: await presignGet(s.imageKey, 3600) })));
  }),

  assignScan: authed
    .input(z.object({ scanId: z.number(), patientId: z.number(), lesionId: z.number().nullish() }))
    .handler(async ({ input }) => {
      const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, input.patientId));
      if (!p) throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });
      const [scan] = await db
        .update(schema.scans)
        .set({ patientId: input.patientId, lesionId: input.lesionId ?? null, patientRef: p.ref })
        .where(eq(schema.scans.id, input.scanId))
        .returning();
      return scan!;
    }),

  remove: authed.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(schema.lesions).where(eq(schema.lesions.patientId, input.id));
    await db
      .update(schema.scans)
      .set({ patientId: null, lesionId: null })
      .where(and(eq(schema.scans.patientId, input.id)));
    await db.delete(schema.patients).where(eq(schema.patients.id, input.id));
    await logAudit(context.user.email, "paciente.eliminar", String(input.id));
    return { ok: true };
  }),
};
