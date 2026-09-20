import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  useCreateLesion,
  useDeletePatient,
  usePatient,
  useUpdateLesionStatus,
} from "../queries/patients";
import { useTaxonomy } from "../queries/scans";
import { Empty, Loader, TriageBadge, fmtDate, fmtDay } from "../components/clinic";

const ESTADOS: Record<string, string> = {
  en_seguimiento: "En seguimiento",
  resuelta: "Resuelta",
  derivada: "Derivada",
};

export default function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const patient = usePatient(Number(id));
  const taxonomy = useTaxonomy();
  const createLesion = useCreateLesion();
  const updateStatus = useUpdateLesionStatus();
  const removePatient = useDeletePatient();

  const [label, setLabel] = useState("");
  const [site, setSite] = useState("");
  const [selectedLesion, setSelectedLesion] = useState<number | "todas">("todas");

  if (patient.isLoading) return <Loader text="Cargando ficha del paciente..." />;
  if (patient.isError || !patient.data) return <Empty text="Paciente no encontrado." />;

  const { patient: p, lesions, scans } = patient.data;
  const labels = Object.fromEntries((taxonomy.data?.classes ?? []).map((c) => [c.code, c.label]));
  const visibles = selectedLesion === "todas" ? scans : scans.filter((s) => s.lesionId === selectedLesion);
  const cronologia = [...visibles].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/pacientes" className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
            <ArrowLeft size={13} /> Pacientes
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">{p.fullName}</h1>
          <p className="mono text-sm text-muted-foreground">{p.ref}</p>
        </div>
        <button
          type="button"
          className="btn-ghost !text-danger"
          onClick={() => {
            if (confirm(`¿Eliminar la ficha de ${p.fullName}? Los escaneos se conservarán sin asignar.`)) {
              removePatient.mutate({ id: p.id }, { onSuccess: () => navigate("/pacientes") });
            }
          }}
        >
          <Trash2 size={15} /> Eliminar ficha
        </button>
      </header>

      <section className="card-clinic grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Data k="Nacimiento" v={p.birthDate || "—"} />
        <Data k="Sexo" v={p.sex || "—"} />
        <Data k="Fototipo" v={p.phototype || "—"} />
        <Data k="Teléfono" v={p.phone || "—"} />
        <Data k="Correo" v={p.email || "—"} />
        <Data k="Escaneos" v={String(scans.length)} />
        {p.notes && (
          <p className="sm:col-span-3 lg:col-span-6 rounded-lg bg-surface2 px-3 py-2 text-xs leading-relaxed">
            <strong>Antecedentes:</strong> {p.notes}
          </p>
        )}
      </section>

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Lesiones en seguimiento</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            createLesion.mutate(
              { patientId: p.id, label: label.trim(), bodySite: site || null },
              { onSuccess: () => { setLabel(""); setSite(""); } },
            );
          }}
        >
          <input className="field max-w-48" aria-label="Nombre de la lesion" placeholder="Nombre de la lesión" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="field max-w-48" aria-label="Zona anatomica de la lesion" placeholder="Zona anatómica" value={site} onChange={(e) => setSite(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={createLesion.isPending}>
            <Plus size={15} /> Añadir
          </button>
        </form>

        {lesions.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Aún no hay lesiones registradas. Cree una para comparar su evolución entre escaneos.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {lesions.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-bold">{l.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.bodySite || "Sin zona"} · creada el {fmtDay(l.createdAt)} ·{" "}
                    {scans.filter((s) => s.lesionId === l.id).length} escaneo(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="field !w-auto !py-1.5 text-xs"
                    value={l.status}
                    onChange={(e) =>
                      updateStatus.mutate({ id: l.id, status: e.target.value as "en_seguimiento" | "resuelta" | "derivada" })
                    }
                  >
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button
                    type="button"
                    className={`btn-ghost !py-1.5 text-xs ${selectedLesion === l.id ? "!border-primary !text-primary" : ""}`}
                    onClick={() => setSelectedLesion(selectedLesion === l.id ? "todas" : l.id)}
                  >
                    Ver evolución
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-clinic p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold">
            Línea de tiempo {selectedLesion !== "todas" && "· lesión seleccionada"}
          </h2>
          {selectedLesion !== "todas" && (
            <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setSelectedLesion("todas")}>
              Ver todos los escaneos
            </button>
          )}
        </div>

        {cronologia.length === 0 ? (
          <Empty text="Sin escaneos asignados a este paciente todavía." />
        ) : (
          <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
            {cronologia.map((s, i) => {
              const prev = cronologia[i - 1];
              const delta = prev ? s.malignancyRisk - prev.malignancyRisk : 0;
              return (
                <Link key={s.id} to={`/reporte/${s.id}`} className="w-52 shrink-0 rounded-xl border border-border p-3 transition hover:border-primary">
                  <img src={s.imageUrl} alt="" className="h-32 w-full rounded-lg border border-border object-cover" />
                  <p className="mt-2 text-[11px] font-bold">{fmtDate(s.createdAt)}</p>
                  <p className="mt-0.5 truncate text-xs font-extrabold">
                    {s.conclusive ? (labels[s.diagnosisCode] ?? s.diagnosis) : "No concluyente"}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <TriageBadge triage={s.triage} size="sm" />
                    <span className="mono text-[11px] font-bold">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                  {prev && (
                    <p
                      className="mono mt-2 text-[10px] font-bold"
                      style={{ color: delta > 0.05 ? "var(--danger)" : delta < -0.05 ? "var(--ok)" : "var(--muted-foreground)" }}
                    >
                      Riesgo {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(0)} pts vs. anterior
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Data({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="label-xs">{k}</p>
      <p className="mt-0.5 text-sm font-bold">{v}</p>
    </div>
  );
}
