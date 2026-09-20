import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { useReviewScan, useScan, useTaxonomy } from "../queries/scans";
import { Empty, Loader, TriageBadge, fmtDate } from "../components/clinic";
import { Receipt } from "../components/receipt";
import { severityClass } from "../components/scan-result";

const ABCDE_CAMPOS = [
  { key: "aplica", label: "A · Criterio aplicable a la lesión" },
  { key: "asimetria", label: "A · Asimetría" },
  { key: "bordes_irregulares", label: "B · Bordes irregulares" },
  { key: "color_heterogeneo", label: "C · Color heterogéneo" },
  { key: "diametro_mayor_6mm", label: "D · Diámetro mayor de 6 mm" },
  { key: "evolucion_o_elevacion", label: "E · Evolución o elevación" },
];

/** Imprime únicamente el ticket térmico, ocultando la hoja clínica A4. */
function imprimirRecibo() {
  document.body.classList.add("print-recibo");
  window.print();
  window.setTimeout(() => document.body.classList.remove("print-recibo"), 500);
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const scanQuery = useScan(Number(id));
  const taxonomy = useTaxonomy();
  const review = useReviewScan();
  const [note, setNote] = useState("");

  if (scanQuery.isLoading) return <Loader text="Cargando reporte..." />;
  if (scanQuery.isError || !scanQuery.data) return <Empty text="No se encontró el escaneo solicitado." />;

  const { scan, patient, clinicName } = scanQuery.data;
  const classes = taxonomy.data?.classes ?? [];
  const labels = Object.fromEntries(classes.map((c) => [c.code, c.label]));
  const info = classes.find((c) => c.code === scan.diagnosisCode);
  const threshold = taxonomy.data?.threshold ?? 0.6;
  const probs = Object.entries(scan.probabilities ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const abcde = (scan.abcde ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/historial" className="btn-ghost">
          <ArrowLeft size={15} /> Volver al historial
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => imprimirRecibo()}>
            <ReceiptIcon size={15} /> Imprimir recibo
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / guardar PDF
          </button>
        </div>
      </header>

      <article className="print-sheet mx-auto w-full max-w-[820px] rounded-xl border border-border bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-white">D</span>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">DET-Cut IA</h1>
              <p className="text-[11px] text-muted-foreground">{clinicName} · Reporte de apoyo diagnóstico</p>
            </div>
          </div>
          <div className="text-right text-[11px]">
            <p className="mono font-bold">{scan.code}</p>
            <p className="text-muted-foreground">{fmtDate(scan.createdAt)}</p>
            <p className="mono text-muted-foreground">Motor v{scan.engineVersion}</p>
          </div>
        </div>

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px]">
          <Field k="Paciente" v={patient ? `${patient.fullName} (${patient.ref})` : scan.patientRef || "No asignado"} />
          <Field k="Fecha de nacimiento" v={patient?.birthDate || "—"} />
          <Field k="Sexo" v={patient?.sex || "—"} />
          <Field k="Fototipo" v={patient?.phototype || "—"} />
          <Field k="Zona anatómica" v={scan.bodySite || "—"} />
          <Field k="Origen de la captura" v={scan.source === "dispositivo" ? "Dispositivo ESP32-CAM" : scan.source === "camara" ? "Cámara en vivo" : "Carga web"} />
        </section>

        <section className="mt-6 grid grid-cols-[190px_1fr] gap-5">
          <img src={scan.imageUrl} alt="Lesión analizada" className="w-full rounded-lg border border-border object-cover" />
          <div>
            <p className="label-xs">Impresión del sistema</p>
            <h2 className="mt-1 text-xl font-extrabold">
              {scan.conclusive ? scan.diagnosis : "Resultado no concluyente"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TriageBadge triage={scan.triage} size="sm" />
              {scan.conclusive && info?.severity && (
                <span className={severityClass(info.severity)}>{info.severity}</span>
              )}
              <span className="mono rounded-full border border-border px-2 py-0.5 text-[11px] font-bold">
                Confianza {(scan.confidence * 100).toFixed(1)}%
              </span>
              <span className="mono rounded-full border border-border px-2 py-0.5 text-[11px] font-bold">
                Umbral {(threshold * 100).toFixed(0)}%
              </span>
              {scan.isHealthy && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(23,166,115,0.12)", color: "var(--ok)" }}>
                  Sin hallazgos patológicos
                </span>
              )}
            </div>
            {!scan.conclusive && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                La confianza no alcanza el umbral clínico configurado. Se documenta la hipótesis principal
                ({labels[scan.diagnosisCode] ?? scan.diagnosis}) sin emitir diagnóstico.
              </p>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <Box k="Riesgo malignidad" v={`${(scan.malignancyRisk * 100).toFixed(0)}%`} />
              <Box k="Calidad de imagen" v={`${(scan.qualityScore * 100).toFixed(0)}%`} />
              <Box k="Concordancia panel" v={`${(scan.agreement * 100).toFixed(0)}%`} />
            </dl>
          </div>
        </section>

        {info?.summary && (
          <Section title="Resumen clínico">
            <p className="text-[12px] leading-relaxed">{info.summary}</p>
          </Section>
        )}

        {scan.findings && (
          <Section title="Hallazgos">
            <p className="text-[12px] leading-relaxed">{scan.findings}</p>
          </Section>
        )}

        {(info?.medications ?? []).length > 0 && (
          <Section title="Medicamentos sugeridos">
            <ul className="space-y-1.5 text-[12px]">
              {(info?.medications ?? []).map((m) => (
                <li key={m.name} className="border-b border-dashed border-border pb-1.5">
                  <strong>{m.name}</strong> — {m.dosage}
                  <span className="block text-muted-foreground">{m.purpose}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Referencia orientativa. La prescripción corresponde al profesional médico tratante.
            </p>
          </Section>
        )}

        {Object.keys(abcde).length > 0 && (
          <Section title="Criterio ABCDE">
            {abcde.aplica === false ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {typeof abcde.nota === "string" && abcde.nota.trim() !== ""
                  ? abcde.nota
                  : "No aplicable: la lesión no es de aspecto melanocítico, por lo que los criterios ABCDE no se evalúan."}
              </p>
            ) : (
            <ul className="grid gap-1 text-[12px] sm:grid-cols-2">
              {ABCDE_CAMPOS.filter((c) => c.key !== "aplica" && typeof abcde[c.key] === "boolean").map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-2 border-b border-dashed border-border pb-1">
                  <span>{c.label}</span>
                  <span className={`mono font-bold ${abcde[c.key] ? "text-danger" : "text-muted-foreground"}`}>
                    {abcde[c.key] ? "Sí" : "No"}
                  </span>
                </li>
              ))}
            </ul>
            )}
            {abcde.aplica !== false && typeof abcde.nota === "string" && abcde.nota.trim() !== "" && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{abcde.nota}</p>
            )}
          </Section>
        )}

        <Section title="Diagnóstico diferencial ponderado">
          <ul className="space-y-1 text-[12px]">
            {probs.map(([code, p]) => (
              <li key={code} className="flex justify-between border-b border-dashed border-border pb-1">
                <span>{labels[code] ?? code}</span>
                <span className="mono font-bold">{(p * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Conducta recomendada">
          <p className="text-[12px] font-semibold leading-relaxed">{scan.recommendation}</p>
          {info?.recommendations && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{info.recommendations}</p>
          )}
        </Section>

        <Section title="Validación médica">
          {scan.reviewStatus && scan.reviewStatus !== "pendiente" ? (
            <p className="text-[12px]">
              <strong className="capitalize">{scan.reviewStatus}</strong> por {scan.reviewedBy} el {fmtDate(scan.reviewedAt)}.
              {scan.reviewNote ? ` Nota: ${scan.reviewNote}` : ""}
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground">Pendiente de revisión por el profesional responsable.</p>
          )}
          <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
            <div className="border-t border-foreground pt-1">Firma del profesional</div>
            <div className="border-t border-foreground pt-1">N.º de colegiado / sello</div>
          </div>
        </Section>

        <p className="mt-6 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
          DET-Cut IA es un sistema de apoyo al triaje dermatológico basado en un panel de modelos de visión con
          umbral de confianza. No constituye diagnóstico médico definitivo ni sustituye la valoración presencial,
          la dermatoscopia o el estudio histopatológico. Documento generado automáticamente el {fmtDate(new Date())}.
        </p>
      </article>

      <section className="receipt-section card-clinic mx-auto w-full max-w-[820px] p-5">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold">Vista previa de recibo imprimible</h3>
            <p className="text-xs text-muted-foreground">
              Formato ticket para impresora térmica de 58 o 80 mm, igual al prototipo del proyecto.
            </p>
          </div>
          <button type="button" className="btn-ghost no-print" onClick={() => imprimirRecibo()}>
            <ReceiptIcon size={15} /> Imprimir recibo
          </button>
        </div>
        <div className="receipt-frame rounded-xl border border-border bg-surface2 p-4">
          <Receipt
            scan={scan}
            info={info}
            labels={labels}
            patientRef={patient?.ref ?? scan.patientRef}
          />
        </div>
      </section>

      <section className="no-print card-clinic mx-auto w-full max-w-[820px] p-5">
        <h3 className="text-sm font-extrabold">Validación médica del resultado</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Su revisión alimenta la métrica de concordancia de campo del panel de fiabilidad.
        </p>
        <textarea
          aria-label="Nota clinica de la revision"
          className="field mt-3"
          rows={2}
          placeholder="Nota clínica sobre el resultado (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(["confirmado", "corregido", "descartado"] as const).map((estado) => (
            <button
              key={estado}
              type="button"
              className={estado === "confirmado" ? "btn-primary" : "btn-ghost"}
              disabled={review.isPending}
              onClick={() => review.mutate({ id: scan.id, reviewStatus: estado, reviewNote: note || null })}
            >
              {estado === "confirmado" ? "Confirmar diagnóstico" : estado === "corregido" ? "Marcar como corregido" : "Descartar"}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}: </span>
      <strong>{v}</strong>
    </p>
  );
}

function Box({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border px-2 py-1.5">
      <dt className="text-[9px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mono text-sm font-extrabold">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="label-xs mb-1.5 border-b border-border pb-1">{title}</h3>
      {children}
    </section>
  );
}
