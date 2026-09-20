import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export const TRIAGE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  verde: { label: "Sin urgencia", color: "var(--ok)", bg: "rgba(23,166,115,0.10)", border: "rgba(23,166,115,0.35)" },
  ambar: { label: "Valoración preferente", color: "var(--warning)", bg: "rgba(201,122,0,0.10)", border: "rgba(201,122,0,0.35)" },
  rojo: { label: "Derivación urgente", color: "var(--danger)", bg: "rgba(214,69,69,0.10)", border: "rgba(214,69,69,0.35)" },
};

export function TriageBadge({ triage, size = "md" }: { triage: string; size?: "sm" | "md" }) {
  const meta = TRIAGE_META[triage] ?? TRIAGE_META.verde!;
  const Icon = triage === "rojo" ? ShieldAlert : triage === "ambar" ? AlertTriangle : CheckCircle2;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      }`}
      style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {meta.label}
    </span>
  );
}

export function ConfidenceBar({ value, threshold }: { value: number; threshold?: number }) {
  const pct = Math.round(value * 100);
  const color = value >= (threshold ?? 0.6) ? "var(--primary)" : "var(--warning)";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="label-xs">Confianza del motor</span>
        <span className="mono text-lg font-bold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        {threshold !== undefined && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/45"
            style={{ left: `${Math.round(threshold * 100)}%` }}
            title={`Umbral mínimo: ${Math.round(threshold * 100)}%`}
          />
        )}
      </div>
      {threshold !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          Umbral clínico: {Math.round(threshold * 100)}%. Por debajo, el resultado se declara no concluyente.
        </p>
      )}
    </div>
  );
}

export function ClassDistribution({
  probabilities,
  labels,
  top = 5,
}: {
  probabilities: Record<string, number> | null | undefined;
  labels: Record<string, string>;
  top?: number;
}) {
  const entries = Object.entries(probabilities ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, top);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map(([code, p], i) => (
        <div key={code} className="flex items-center gap-3">
          <span className="w-52 shrink-0 truncate text-xs font-semibold">{labels[code] ?? code}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, Math.round(p * 100))}%`,
                background: i === 0 ? "var(--primary)" : "rgba(47,125,230,0.35)",
              }}
            />
          </div>
          <span className="mono w-12 shrink-0 text-right text-xs font-semibold">{(p * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-lg border border-border bg-surface2 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      <strong className="text-foreground">Aviso clínico:</strong> DET-Cut IA es una herramienta de apoyo al
      triaje dermatológico. No sustituye la valoración médica presencial, la dermatoscopia ni el estudio
      histopatológico. Todo resultado debe ser revisado por un profesional de la salud.
    </p>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "ok" | "warning" | "danger" | "primary";
}) {
  const colors: Record<string, string> = {
    default: "var(--foreground)",
    ok: "var(--ok)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    primary: "var(--primary)",
  };
  return (
    <div className="card-clinic p-4">
      <p className="label-xs">{label}</p>
      <p className="mono mt-1.5 text-2xl font-extrabold" style={{ color: colors[tone] }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Loader({ text = "Cargando..." }: { text?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {text}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface2 px-6 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export const fmtDate = (d: string | number | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const fmtDay = (d: string | number | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
