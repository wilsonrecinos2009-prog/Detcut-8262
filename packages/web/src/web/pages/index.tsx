import { Link } from "wouter";
import { ArrowRight, ScanLine } from "lucide-react";
import { useDashboard, useTaxonomy } from "../queries/scans";
import { useSettings } from "../queries/admin";
import { Disclaimer, Empty, Loader, Stat, TriageBadge, fmtDate } from "../components/clinic";

export default function DashboardPage() {
  const dash = useDashboard();
  const settings = useSettings();
  const taxonomy = useTaxonomy();

  if (dash.isLoading) return <Loader text="Cargando panel clínico..." />;
  if (dash.isError || !dash.data)
    return <Empty text="No se pudieron cargar las métricas. Recargue la página." />;

  const d = dash.data;
  const target = Number(settings.data?.accuracy_target ?? "0.8");
  const healthyPct = d.total ? Math.round((d.healthy / d.total) * 100) : 0;
  const counts = new Map(d.series.map((s) => [s.date, s.count]));
  const hoy = new Date();
  const serie30 = Array.from({ length: 30 }, (_, i) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - (29 - i));
    const date = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
    return { date, count: counts.get(date) ?? 0 };
  });
  const maxDay = Math.max(1, ...serie30.map((s) => s.count));
  const labels = Object.fromEntries((taxonomy.data?.classes ?? []).map((c) => [c.code, c.label]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Panel clínico</h1>
          <p className="text-sm text-muted-foreground">
            {settings.data?.clinic_name ?? "DET-Cut IA"} · Resumen de actividad y fiabilidad del motor.
          </p>
        </div>
        <Link to="/escaneo" className="btn-primary">
          <ScanLine size={16} /> Nuevo escaneo
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Escaneos totales" value={d.total} hint={`${d.last30} en los últimos 30 días`} />
        <Stat label="Piel sana detectada" value={`${healthyPct}%`} tone="ok" hint={`${d.healthy} de ${d.total} análisis`} />
        <Stat label="Derivación urgente" value={d.red} tone="danger" hint={`${d.amber} en valoración preferente`} />
        <Stat
          label="Fiabilidad medida"
          value={d.accuracy === null ? "Sin medir" : `${(d.accuracy * 100).toFixed(1)}%`}
          tone={d.accuracy === null ? "default" : d.accuracy >= target ? "ok" : "warning"}
          hint={d.accuracy === null ? "Ejecute el set de prueba" : `Objetivo ${Math.round(target * 100)}% · ${fmtDate(d.accuracyRunAt)}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="No concluyentes" value={d.inconclusive} tone="warning" hint="Confianza bajo el umbral" />
        <Stat label="Pendientes de revisión" value={d.pendingReview} hint="Esperan validación médica" />
        <Stat label="Pacientes" value={d.patients} hint="Fichas registradas" />
        <Stat
          label="Dispositivos en línea"
          value={`${d.devicesOnline}/${d.devices}`}
          tone={d.devicesOnline > 0 ? "primary" : "default"}
          hint="ESP32-CAM activos (5 min)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="card-clinic p-5">
          <h2 className="text-sm font-extrabold">Actividad de los últimos 30 días</h2>
          {d.series.length === 0 ? (
            <Empty text="Aún no hay escaneos registrados." />
          ) : (
            <div className="mt-5 flex h-40 items-end gap-1.5">
              {serie30.map((s) => (
                <div key={s.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="mono text-[10px] font-bold text-muted-foreground opacity-0 transition group-hover:opacity-100">
                    {s.count}
                  </span>
                  <div
                    className={`w-full rounded-t transition ${s.count > 0 ? "bg-primary/75 group-hover:bg-primary" : "bg-primary/10 group-hover:bg-primary/25"}`}
                    style={{ height: s.count > 0 ? `${Math.max(6, (s.count / maxDay) * 100)}%` : "4px" }}
                    title={`${s.date}: ${s.count}`}
                  />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Confianza media del motor: <strong className="mono">{(d.avgConfidence * 100).toFixed(1)}%</strong>
          </p>
        </section>

        <section className="card-clinic p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold">Escaneos recientes</h2>
            <Link to="/historial" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              Ver historial <ArrowRight size={13} />
            </Link>
          </div>
          {d.recent.length === 0 ? (
            <Empty text="Sin escaneos todavía. Comience con uno nuevo." />
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {d.recent.map((s) => (
                <li key={s.id}>
                  <Link to={`/reporte/${s.id}`} className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
                    <img src={s.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">
                        {labels[s.diagnosisCode] ?? s.diagnosis}
                      </span>
                      <span className="mono block text-[10px] text-muted-foreground">
                        {s.code} · {fmtDate(s.createdAt)} · {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </span>
                    <TriageBadge triage={s.triage} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Disclaimer />
    </div>
  );
}
