import { useState } from "react";
import { Link } from "wouter";
import { Download, Trash2 } from "lucide-react";
import { useDeleteScan, useScans, useTaxonomy, downloadCsv } from "../queries/scans";
import { Empty, Loader, TriageBadge, fmtDate } from "../components/clinic";

export default function HistoryPage() {
  const [triage, setTriage] = useState("todos");
  const [source, setSource] = useState("todos");
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const scans = useScans({ triage, source });
  const taxonomy = useTaxonomy();
  const remove = useDeleteScan();

  const labels = Object.fromEntries((taxonomy.data?.classes ?? []).map((c) => [c.code, c.label]));
  const rows = (scans.data ?? []).filter((s) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      s.code.toLowerCase().includes(t) ||
      s.diagnosis.toLowerCase().includes(t) ||
      (s.patientRef ?? "").toLowerCase().includes(t) ||
      (s.bodySite ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Historial de diagnósticos</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} registro{rows.length === 1 ? "" : "s"} · trazabilidad completa de cada análisis.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={exporting || rows.length === 0}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadCsv();
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download size={15} /> {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </header>

      <div className="card-clinic grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <label className="label-xs" htmlFor="q">Buscar</label>
          <input id="q" aria-label="Buscar escaneos" className="field mt-1.5" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Código, diagnóstico, paciente o zona" />
        </div>
        <div>
          <label className="label-xs" htmlFor="tri">Semáforo</label>
          <select id="tri" className="field mt-1.5" value={triage} onChange={(e) => setTriage(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="verde">Sin urgencia</option>
            <option value="ambar">Valoración preferente</option>
            <option value="rojo">Derivación urgente</option>
          </select>
        </div>
        <div>
          <label className="label-xs" htmlFor="src">Origen</label>
          <select id="src" className="field mt-1.5" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="web">Carga web</option>
            <option value="camara">Cámara en vivo</option>
            <option value="dispositivo">ESP32-CAM</option>
          </select>
        </div>
      </div>

      {scans.isLoading ? (
        <Loader text="Cargando historial..." />
      ) : rows.length === 0 ? (
        <Empty text="No hay escaneos que coincidan con los filtros." />
      ) : (
        <div className="card-clinic overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-border bg-surface2">
              <tr className="label-xs">
                <th className="px-4 py-3">Imagen</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Diagnóstico</th>
                <th className="px-4 py-3">Confianza</th>
                <th className="px-4 py-3">Semáforo</th>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Revisión</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="transition hover:bg-surface2">
                  <td className="px-4 py-2.5">
                    <img src={s.imageUrl} alt={`Miniatura del escaneo ${s.code}`} className="h-10 w-10 rounded-md border border-border object-cover" />
                  </td>
                  <td className="mono px-4 py-2.5 font-bold">
                    <Link to={`/reporte/${s.id}`} className="text-primary">{s.code}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold">{s.conclusive ? (labels[s.diagnosisCode] ?? s.diagnosis) : "No concluyente"}</span>
                    {s.bodySite && <span className="block text-[10px] text-muted-foreground">{s.bodySite}</span>}
                  </td>
                  <td className="mono px-4 py-2.5 font-bold">{(s.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2.5"><TriageBadge triage={s.triage} size="sm" /></td>
                  <td className="px-4 py-2.5">{s.patientRef || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(s.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.reviewStatus === "confirmado" ? "bg-ok/10 text-ok"
                        : s.reviewStatus === "corregido" ? "bg-warning/10 text-warning"
                        : s.reviewStatus === "descartado" ? "bg-danger/10 text-danger"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {s.reviewStatus ?? "pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-danger/10 hover:text-danger"
                      title="Eliminar registro"
                      onClick={() => {
                        if (confirm(`¿Eliminar el escaneo ${s.code}? Esta acción no se puede deshacer.`)) {
                          remove.mutate({ id: s.id });
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
