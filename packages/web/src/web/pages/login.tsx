import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { authClient } from "../lib/auth";

/**
 * Pantalla de acceso. Replica el diseño del prototipo original del proyecto:
 * rejilla de dos columnas, panel de marca a la izquierda con degradado y
 * destellos radiales, formulario con pestañas a la derecha.
 */
const FEATURES = [
  "Análisis de imágenes con modelos de visión",
  "7 clases del set de datos, incluida piel sana",
  "Reportes clínicos e impresión inmediata",
  "Historial guardado en base de datos segura",
  "Exportación mensual de diagnósticos en CSV",
];

const GOOGLE_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23EA4335' d='M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z'/%3E%3Cpath fill='%234285F4' d='M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z'/%3E%3Cpath fill='%23FBBC05' d='M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z'/%3E%3Cpath fill='%2334A853' d='M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z'/%3E%3C/svg%3E";

export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "registro">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        tab === "login"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name || email.split("@")[0]! });
      if (res.error) {
        setError(traducirError(res.error.message ?? ""));
        return;
      }
      window.location.href = "/";
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await authClient.managedAuth.signIn({ provider: "google" });
      window.location.href = "/";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("POPUP_CLOSED")) setError("No se pudo iniciar sesión con Google.");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LADO IZQUIERDO — Marca */}
      <div className="login-left hidden flex-col justify-center p-[60px] lg:flex">
        <div className="relative mb-[60px] flex items-center gap-3.5">
          <div className="brand-icon">DET</div>
          <div>
            <div className="brand-name">DET-Cut IA</div>
            <div className="brand-sub">· Dermatología</div>
          </div>
        </div>

        <div className="login-headline relative mb-5">
          Diagnóstico
          <br />
          dermatológico
          <br />
          <span>con IA</span>
        </div>

        <p className="login-desc relative mb-12">
          Sistema de apoyo clínico para la detección temprana de patologías cutáneas. Diseñado para
          médicos generales y personal de salud en El Salvador.
        </p>

        <div className="relative flex flex-col gap-4">
          {FEATURES.map((f) => (
            <div key={f} className="feature-item">
              <div className="feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* LADO DERECHO — Formulario */}
      <div className="flex items-center justify-center border-border bg-surface px-6 py-12 lg:border-l lg:px-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3.5 lg:hidden">
            <div className="brand-icon">DET</div>
            <div>
              <div className="brand-name">DET-Cut IA</div>
              <div className="brand-sub">· Dermatología</div>
            </div>
          </div>

          <div className="login-tabs mb-8">
            {(["login", "registro"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => {
                  setTab(t);
                  setError(null);
                }}
              >
                {t === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

          {error && <div className="auth-error mb-4">{error}</div>}

          <div className="login-form-title mb-1.5">{tab === "login" ? "Bienvenido" : "Crear cuenta"}</div>
          <p className="login-form-sub mb-7">
            {tab === "login"
              ? "Ingresa tus credenciales para acceder al sistema."
              : "Regístrate para usar el sistema DET-Cut IA."}
          </p>

          <form onSubmit={submit}>
            {tab === "registro" && (
              <div className="mb-4">
                <label className="field-label" htmlFor="regName">
                  Nombre completo
                </label>
                <input
                  id="regName"
                  aria-label="Nombre completo"
                  className="field-input"
                  placeholder="Dra. María López"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="mb-4">
              <label className="field-label" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                aria-label="Correo electronico"
                type="email"
                required
                className="field-input"
                placeholder="doctor@clinica.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="field-label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                aria-label="Contrasena"
                type="password"
                required
                minLength={8}
                className="field-input"
                placeholder={tab === "login" ? "••••••••" : "Mínimo 8 caracteres"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-login mt-2" disabled={loading}>
              {loading && <LoaderCircle size={16} className="animate-spin" />}
              {tab === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          <div className="divider-text my-5">{tab === "login" ? "o continúa con" : "o regístrate con"}</div>

          <button type="button" className="btn-google" onClick={google}>
            <img src={GOOGLE_ICON} alt="" className="h-[18px] w-[18px]" />
            Continuar con Google
          </button>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            El primer usuario registrado obtiene el rol de administrador. Cada acceso y cada análisis quedan
            registrados en la bitácora de auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * La interfaz es íntegramente en español: nunca se muestra el mensaje crudo
 * del servidor de autenticación, que llega en inglés.
 */
function traducirError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("invalid") && m.includes("password")) return "Correo o contraseña incorrectos.";
  if (m.includes("invalid") && m.includes("email")) return "El correo introducido no es válido.";
  if (m.includes("credential")) return "Correo o contraseña incorrectos.";
  if (m.includes("already") || m.includes("exists")) return "Ya existe una cuenta con ese correo.";
  if (m.includes("user not found")) return "No existe una cuenta con ese correo.";
  if (m.includes("password")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("too many") || m.includes("rate limit"))
    return "Demasiados intentos. Espere un momento e inténtelo de nuevo.";
  if (m.includes("network") || m.includes("fetch")) return "No se pudo conectar con el servidor.";
  return "No se pudo completar la operación. Revise los datos e inténtelo de nuevo.";
}
