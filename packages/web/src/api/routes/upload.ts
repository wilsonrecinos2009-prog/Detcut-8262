import { z } from "zod";
import { authed } from "../middleware/auth";
import { presignGet, presignPut } from "../lib/s3";

export const upload = {
  /** URL prefirmada para subir una imagen de lesión directamente al almacenamiento. */
  presign: authed
    .input(z.object({ filename: z.string(), contentType: z.string() }))
    .handler(async ({ input }) => {
      const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const key = `escaneos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
      const url = await presignPut(key, input.contentType);
      return { url, key };
    }),

  /** URL de lectura temporal para mostrar una imagen ya almacenada. */
  view: authed.input(z.object({ key: z.string() })).handler(async ({ input }) => {
    return { url: await presignGet(input.key, 3600) };
  }),
};
