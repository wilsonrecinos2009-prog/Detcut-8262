import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
};

/** Auth opcional: `context.user` es el usuario o null. */
export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({
    context: { user: (session?.user as SessionUser | undefined) ?? null, session: session?.session ?? null },
  });
});

/** Procedimientos protegidos: exige sesión. */
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED", { message: "Sesión requerida" });
  return next({ context: { user: session.user as SessionUser, session: session.session } });
});

/** Solo administradores. */
export const adminOnly = authed.use(async ({ context, next }) => {
  if (context.user.role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "Requiere rol de administrador" });
  }
  return next();
});
