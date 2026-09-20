import { Link } from "wouter";
import { AlertTriangle, FileText, Gauge, Info, Printer, Users } from "lucide-react";
import { TriageBadge, fmtDate } from "./clinic";

export type ScanLike = {
  id: number;
  code: string;
  imageUrl?: string;
  diagnosis: string;
  diagnosisCode: string;
  confidence: number;
  isHealthy: boolean;
  conclusive: boolean;
  triage: string;
  malignancyRisk: number;
  qualityScore: number;
  qualityIssues?: string[] | null;
  probabilities?: Record<string, number> | null;
  abcde?: Record<string, unknown> | null;
  findings?: string | null;
  recommendation?: string | null;
  differentials?: string[] | null;
  agreement: number;
  engineVersion: string;
  latencyMs: number;
  bodySite?: string | null;
  patientRef?: string | null;
  source: string;
  createdAt: string | Date;
};

/** Ficha clínica del catálogo, tal como la expone scans.taxonomy. */
export type ClassInfo = {
  code: string;
  label: string;
  severity?: string;
  summary?: string;
  recommendations?: string;
  medications?: { name: string; dosage: string; purpose: string }[];
  differential?: { code: string; probability: number }[];
};

export function severityClass(severity?: string) {
  switch (severity) {
    case "Severa":
      return "badge badge-severa";
    case "Moderada":
      return "badge badge-moderada";
    case "Leve":
      return "badge badge-leve";
    default:
      return "badge badge-normal";
  }
}

export function origenLabel(source: string) {
  if (source === "dispositivo") return "ESP32-CAM";
  if (source === "camara") return "Cámara en vivo";
  return "Carga web";
}

export function ScanResult({
  scan,
  labels,
  threshold,
  classes,
  actions,
}: {
  scan: ScanLike;
  labels: Record<string, string>;
  threshold: number;
  classes?: ClassInfo[];
  actions?: React.ReactNode;
}) {
  const info = classes?.find((c) => c.code === scan.diagnosisCode);
  const severity = scan.conclusive ? info?.severity ?? "Normal" : "Moderada";
  const pct = (scan.confidence * 100).toFixed(1);

  // El diferencial prioriza las probabilidades reales del motor; si no hay, usa el
  // diferencial de referencia del catálogo clínico.
  const motor = Object.entries(scan.probabilities ?? {})
    .filter(([code]) => code !== scan.diagnosisCode)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const diff = motor.length
    ? motor.map(([code, p]) => ({ label: labels[code] ?? code, probability: p }))
    : (info?.differential ?? []).map((d) => ({ label: labels[d.code] ?? d.code, probability: d.probability }));

  return (
    <div className="space-y-4">
      <article className="card-clinic overflow-hidden">
        <header className="report-header-grad flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <div className="report-eyebrow">Reporte de Diagnóstico · DET-Cut IA</div>
            <h2 className="report-disease mt-1">
              {scan.conclusive ? scan.diagnosis : "Resultado no concluyente"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={severityClass(severity)}>
                {scan.conclusive ? severity : "Requiere valoración"}
              </span>
              <span className="badge badge-meta mono">{scan.code}</span>
              <span className="badge badge-meta">{fmtDate(scan.createdAt)}</span>
              <span className="badge badge-meta">{origenLabel(scan.source)}</span>
              <TriageBadge triage={scan.triage} size="sm" />
            </div>
          </div>
          <Link to={`/reporte/${scan.id}`} className="btn-ghost no-print">
            <Printer size={15} /> Imprimir reporte
          </Link>
        </header>

        <div className="grid gap-5 p-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            {scan.imageUrl && (
              <img
                src={scan.imageUrl}
                alt="Lesión analizada"
                className="w-full rounded-xl border border-border object-cover"
              />
            )}
            <div className="confidence-box">
              <div className="flex items-end justify-between gap-2">
                <span className="confidence-label">Confianza IA</span>
                <span className="confidence-pct">{pct}%</span>
              </div>
              <div className="confidence-bar mt-2">
                <div className="confidence-fill" style={{ width: `${Math.min(100, scan.confidence * 100)}%` }} />
              </div>
              <p className="mono mt-2 text-[10px] text-muted-foreground">
                Umbral clínico {(threshold * 100).toFixed(0)}% · concordancia {(scan.agreement * 100).toFixed(0)}%
              </p>
            </div>
            <div className="card-clinic space-y-2 p-3 text-[11px]">
              <Row k="Zona" v={scan.bodySite || "—"} />
              <Row k="Paciente" v={scan.patientRef || "Sin asignar"} />
              <Row k="Riesgo malignidad" v={`${(scan.malignancyRisk * 100).toFixed(0)}%`} />
              <Row k="Calidad imagen" v={`${(scan.qualityScore * 100).toFixed(0)}%`} />
              <Row k="Motor" v={<span className="mono">v{scan.engineVersion} · {(scan.latencyMs / 1000).toFixed(1)}s</span>} />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            {!scan.conclusive && (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                La confianza no alcanza el umbral clínico. Hipótesis principal:{" "}
                {labels[scan.diagnosisCode] ?? scan.diagnosis}. No se emite diagnóstico.
              </p>
            )}

            {scan.qualityIssues && scan.qualityIssues.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] font-semibold text-warning">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Calidad de imagen: {scan.qualityIssues.join(", ")}.
              </p>
            )}

            <section>
              <div className="section-title">Resumen Clínico</div>
              <p className="text-[13px] leading-relaxed">
                {info?.summary ?? scan.findings ?? "Sin resumen disponible para esta clase."}
              </p>
              {scan.findings && info?.summary && (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Hallazgos de la imagen: {scan.findings}
                </p>
              )}
            </section>

            <section>
              <div className="section-title">Medicamentos Sugeridos</div>
              {(info?.medications ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No se sugiere tratamiento farmacológico para este resultado.
                </p>
              ) : (
                <div className="space-y-2">
                  {(info?.medications ?? []).map((m) => (
                    <div key={m.name} className="med-item">
                      <div className="med-name">{m.name}</div>
                      <div className="med-dose">{m.dosage}</div>
                      <div className="med-purpose">{m.purpose}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="section-title">Recomendaciones</div>
              <p className="text-[13px] leading-relaxed">
                {scan.recommendation || info?.recommendations || "—"}
              </p>
              {info?.recommendations && scan.recommendation && (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{info.recommendations}</p>
              )}
            </section>

            <section>
              <div className="section-title">Diagnóstico Diferencial</div>
              {diff.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Sin alternativas relevantes.</p>
              ) : (
                <ul className="space-y-2">
                  {diff.map((d) => (
                    <li key={d.label}>
                      <div className="flex items-center justify-between gap-3 text-[12px] font-semibold">
                        <span className="truncate">{d.label}</span>
                        <span className="mono text-muted-foreground">{(d.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="diff-bar-wrap mt-1">
                        <div
                          className="diff-bar-fill"
                          style={{ width: `${Math.min(100, d.probability * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="flex items-start gap-2 rounded-lg border border-border bg-surface2 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info size={14} className="mt-0.5 shrink-0 text-primary" />
              <span>
                Este reporte es generado por IA y sirve como <strong>apoyo</strong> al diagnóstico clínico. La
                decisión final corresponde al profesional médico tratante.
              </span>
            </p>

            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

            <div className="no-print flex flex-wrap gap-2">
              <Link to={`/reporte/${scan.id}`} className="btn-ghost">
                <FileText size={15} /> Reporte clínico
              </Link>
              <Link to="/pacientes" className="btn-ghost">
                <Users size={15} /> Asignar a paciente
              </Link>
              <Link to="/fiabilidad" className="btn-ghost">
                <Gauge size={15} /> Ver fiabilidad del motor
              </Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
