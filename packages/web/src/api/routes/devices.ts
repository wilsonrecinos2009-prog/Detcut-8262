import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { logAudit } from "../lib/settings";

function newToken() {
  const raw = crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
  return `dct_${raw.slice(0, 40)}`;
}

export const devices = {
  list: authed.handler(async () => {
    const rows = await db.select().from(schema.devices).orderBy(desc(schema.devices.createdAt));
    return rows.map((d) => ({
      ...d,
      online: !!d.lastSeenAt && +d.lastSeenAt > Date.now() - 5 * 60_000,
    }));
  }),

  create: authed
    .input(z.object({ name: z.string().min(2), location: z.string().nullish() }))
    .handler(async ({ input, context }) => {
      const [device] = await db
        .insert(schema.devices)
        .values({ name: input.name, location: input.location ?? null, token: newToken(), ownerId: context.user.id })
        .returning();
      await logAudit(context.user.email, "dispositivo.crear", device!.name);
      return device!;
    }),

  rotateToken: authed.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    const [device] = await db
      .update(schema.devices)
      .set({ token: newToken() })
      .where(eq(schema.devices.id, input.id))
      .returning();
    await logAudit(context.user.email, "dispositivo.rotar_token", device!.name);
    return device!;
  }),

  setActive: authed
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .handler(async ({ input }) => {
      const [device] = await db
        .update(schema.devices)
        .set({ active: input.active })
        .where(eq(schema.devices.id, input.id))
        .returning();
      return device!;
    }),

  remove: authed.input(z.object({ id: z.number() })).handler(async ({ input, context }) => {
    await db.delete(schema.devices).where(eq(schema.devices.id, input.id));
    await logAudit(context.user.email, "dispositivo.eliminar", String(input.id));
    return { ok: true };
  }),
};
