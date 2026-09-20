import type { RouterClient } from "@orpc/server";
import { eq, sql } from "drizzle-orm";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { db } from "./database";
import * as schema from "./database/schema";
import { putObject } from "./lib/s3";
import { runScan } from "./lib/scan-service";
import { NotSkinError } from "./analysis/engine";
import { ping } from "./routes/ping";
import { upload } from "./routes/upload";
import { scans } from "./routes/scans";
import { patients } from "./routes/patients";
import { devices } from "./routes/devices";
import { validation } from "./routes/validation";
import { admin } from "./routes/admin";

export const router = {
  ping,
  upload,
  scans,
  patients,
  devices,
  validation,
  admin,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/** Resuelve y actualiza el dispositivo a partir del token de cabecera. */
async function resolveDevice(token: string | undefined) {
  if (!token) return null;
  const [device] = await db.select().from(schema.devices).where(eq(schema.devices.token, token));
  if (!device || !device.active) return null;
  return device;
}

/** Latido del dispositivo: el ESP32-CAM lo llama para reportar que sigue en línea. */
app.get("/api/ingest/ping", async (c) => {
  const device = await resolveDevice(c.req.header("x-device-token"));
  if (!device) return c.json({ ok: false, error: "Token de dispositivo inválido" }, 401);
  await db.update(schema.devices).set({ lastSeenAt: new Date() }).where(eq(schema.devices.id, device.id));
  return c.json({ ok: true, device: device.name, server_time: new Date().toISOString() }, 200);
});

/**
 * Ingesta de capturas del prototipo (ESP32-CAM).
 * Acepta el JPEG crudo en el cuerpo (Content-Type: image/jpeg) o JSON {image_base64}.
 * Analiza en el servidor y devuelve el resultado para mostrarlo en el dispositivo.
 */
app.post("/api/ingest/scan", async (c) => {
  const device = await resolveDevice(c.req.header("x-device-token"));
  if (!device) return c.json({ ok: false, error: "Token de dispositivo inválido o inactivo" }, 401);

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  let bytes: Uint8Array;
  let mediaType = "image/jpeg";
  let patientRef = c.req.query("patient_ref") ?? null;
  let bodySite = c.req.query("body_site") ?? null;

  try {
    if (contentType.includes("application/json")) {
      const body = (await c.req.json()) as { image_base64?: string; patient_ref?: string; body_site?: string };
      if (!body.image_base64) return c.json({ ok: false, error: "Falta image_base64" }, 400);
      const clean = body.image_base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      bytes = new Uint8Array(Buffer.from(clean, "base64"));
      patientRef = body.patient_ref ?? patientRef;
      bodySite = body.body_site ?? bodySite;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("image");
      if (!(file instanceof File)) return c.json({ ok: false, error: "Falta el campo 'image'" }, 400);
      bytes = new Uint8Array(await file.arrayBuffer());
      mediaType = file.type || "image/jpeg";
      patientRef = (form.get("patient_ref") as string | null) ?? patientRef;
      bodySite = (form.get("body_site") as string | null) ?? bodySite;
    } else {
      bytes = new Uint8Array(await c.req.arrayBuffer());
      mediaType = contentType.startsWith("image/") ? contentType : "image/jpeg";
    }
  } catch {
    return c.json({ ok: false, error: "No se pudo leer la imagen" }, 400);
  }

  if (!bytes || bytes.byteLength < 1024) {
    return c.json({ ok: false, error: "Imagen vacía o demasiado pequeña" }, 400);
  }

  const key = `escaneos/dispositivo-${device.id}-${Date.now()}.jpg`;
  await putObject(key, bytes, mediaType);

  await db
    .update(schema.devices)
    .set({ lastSeenAt: new Date(), captureCount: sql`${schema.devices.captureCount} + 1` })
    .where(eq(schema.devices.id, device.id));

  let patientId: number | null = null;
  if (patientRef) {
    const [p] = await db.select().from(schema.patients).where(eq(schema.patients.ref, patientRef));
    patientId = p?.id ?? null;
  }

  try {
    const scan = await runScan({
      imageKey: key,
      userId: device.ownerId,
      patientId,
      patientRef,
      bodySite,
      source: "dispositivo",
      deviceId: device.id,
    });
    return c.json(
      {
        ok: true,
        code: scan.code,
        diagnostico: scan.diagnosis,
        confianza: Number((scan.confidence * 100).toFixed(1)),
        piel_sana: scan.isHealthy,
        concluyente: scan.conclusive,
        triaje: scan.triage,
        recomendacion: scan.recommendation,
      },
      200,
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const message = err instanceof NotSkinError
      ? err.message
      : raw.includes("no está disponible")
        ? raw
        : "Error de análisis en el servidor";
    return c.json({ ok: false, error: message }, err instanceof NotSkinError ? 422 : 500);
  }
});

export default app;
