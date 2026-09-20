import { useState } from "react";
import { LoaderCircle, Play, Plus, Trash2 } from "lucide-react";
import {
  useAddCase,
  useAddCaseFromUrl,
  useExecuteValidation,
  useFieldAgreement,
  useRemoveCase,
  useRuns,
  useTestCases,
  uploadTestImage,
} from "../queries/validation";
import { useTaxonomy } from "../queries/scans";
import { useSettings } from "../queries/admin";
import { Empty, Loader, Stat, fmtDate } from "../components/clinic";

export default function ValidationPage() {
  const cases = useTestCases();
  const runs = useRuns();
  const agreement = useFieldAgreement();
  const taxonomy = useTaxonomy();
  const settings = useSettings();
  const addCase = useAddCase();
  const addFromUrl = useAddCaseFromUrl();
  const removeCase = useRemoveCase();
  const execute = useExecuteValidation();

  const [label, setLabel] = useState("piel_sana");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [limit, setLimit] = useState(20);

  const classes = taxonomy.data?.classes ?? [];
  const labels = Object.fromEntries(classes.map((c) => [c.code, c.label]));
  const target = Number(settings.data?.accuracy_target ?? "0.8");
  const lastRun = runs.data?.[0];
  const confusion = (lastRun?.confusion ?? {}) as Record<string, Record<string, number>>;
  const perClass = (lastRun?.perClass ?? []) as {
    code: string; label: string; support: number; recall: number | null; precision: number | null; specificity: number | null;
  }[];
  const presentes = classes.filter((c) => (cases.data ?? []).some((x) => x.trueLabel === c.code));

  async function subir(file: File) {
    setError(null);
    setUploading(true);
    try {
      const imageKey = await uploadTestImage(file);
      await addCase.mutateAsync({ imageKey, trueLabel: label, dataset: "interno" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el caso.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Fiabilidad del motor</h1>
        <p className="text-sm text-muted-foreground">
          La cifra de precisión se mide contra un set de imágenes etiquetadas, no se declara.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Precisión de la última corrida"
          value={lastRun ? `${(lastRun.accuracy * 100).toFixed(1)}%` : "Sin medir"}
          tone={!lastRun ? "default" : lastRun.accuracy >= target ? "ok" : "warning"}
          hint={lastRun ? `${lastRun.correct}/${lastRun.total} aciertos · objetivo ${Math.round(target * 100)}%` : "Ejecute el set de prueba"}
        />
        <Stat
          label="Sensibilidad en piel sana"
          value={lastRun ? `${(lastRun.healthyRecall * 100).toFixed(0)}%` : "—"}
          tone="ok"
          hint="Piel sana clasificada correctamente"
        />
        <Stat
          label="Sensibilidad en lesión maligna"
          value={lastRun ? `${(lastRun.malignantRecall * 100).toFixed(0)}%` : "—"}
          tone="danger"
          hint="Malignas detectadas como malignas"
        />
        <Stat
          label="Concordancia de campo"
          value={agreement.data?.agreement !== null && agreement.data?.agreement !== undefined ? `${(agreement.data.agreement * 100).toFixed(0)}%` : "—"}
          tone="primary"
          hint={`${agreement.data?.reviewed ?? 0} escaneos revisados por médicos`}
        />
      </div>

      <section className="card-clinic p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold">Ejecutar validación</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {(cases.data ?? []).length} caso(s) en el set · {presentes.length} clase(s) representadas.
              Cada corrida vuelve a analizar las imágenes con el motor actual.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="label-xs" htmlFor="limit">Casos por corrida</label>
              <input id="limit" aria-label="Casos por corrida" type="number" min={1} max={40} className="field mt-1.5 !w-28" value={limit}
                onChange={(e) => setLimit(Number(e.target.value))} />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={execute.isPending || (cases.data ?? []).length === 0}
              onClick={() => { setError(null); execute.mutate({ limit }, { onError: (e) => setError(e.message) }); }}
            >
              {execute.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}
              {execute.isPending ? "Ejecutando..." : "Ejecutar set de prueba"}
            </button>
          </div>
        </div>
        {execute.isPending && (
          <p className="mt-3 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-muted-foreground">
            Analizando cada imagen del set. Puede tardar varios minutos según el número de casos.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>
        )}
      </section>

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Agregar casos etiquetados</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-[220px_1fr]">
          <div>
            <label className="label-xs" htmlFor="tl">Etiqueta verdadera</label>
            <select id="tl" className="field mt-1.5" value={label} onChange={(e) => setLabel(e.target.value)}>
              {classes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-xs" htmlFor="tf">Desde archivo</label>
              <input id="tf" aria-label="Cargar caso desde archivo" type="file" accept="image/*" className="field mt-1.5 !py-1.5 text-xs"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void subir(f); e.target.value = ""; }} />
            </div>
            <div>
              <label className="label-xs" htmlFor="tu">Desde URL pública (ISIC, DermNet...)</label>
              <div className="mt-1.5 flex gap-2">
                <input id="tu" aria-label="URL publica de la imagen" className="field" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!url || addFromUrl.isPending}
                  onClick={() => {
                    setError(null);
                    addFromUrl.mutate(
                      { url, trueLabel: label, dataset: "externo" },
                      { onSuccess: () => setUrl(""), onError: (e) => setError(e.message) },
                    );
                  }}
                >
                  {addFromUrl.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {cases.isLoading ? (
          <Loader text="Cargando set de prueba..." />
        ) : (cases.data ?? []).length === 0 ? (
          <Empty text="El set de prueba está vacío. Agregue imágenes con su diagnóstico confirmado." />
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {(cases.data ?? []).map((c) => (
              <div key={c.id} className="group relative overflow-hidden rounded-lg border border-border">
                <img src={c.imageUrl} alt="" className="h-20 w-full object-cover" />
                <p className="truncate bg-surface2 px-1.5 py-1 text-[9px] font-bold">{labels[c.trueLabel] ?? c.trueLabel}</p>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-danger opacity-0 transition group-hover:opacity-100"
                  onClick={() => removeCase.mutate({ id: c.id })}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {lastRun && perClass.length > 0 && (
        <section className="card-clinic p-5">
          <h2 className="text-sm font-extrabold">Métricas por clase</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Corrida del {fmtDate(lastRun.createdAt)} · motor v{lastRun.engineVersion} · umbral {(lastRun.threshold * 100).toFixed(0)}%
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-border bg-surface2">
                <tr className="label-xs">
                  <th className="px-3 py-2.5">Clase</th>
                  <th className="px-3 py-2.5">Casos</th>
                  <th className="px-3 py-2.5">Sensibilidad</th>
                  <th className="px-3 py-2.5">Precisión</th>
                  <th className="px-3 py-2.5">Especificidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perClass.filter((r) => r.support > 0).map((r) => (
                  <tr key={r.code}>
                    <td className="px-3 py-2 font-bold">{r.label}</td>
                    <td className="mono px-3 py-2">{r.support}</td>
                    <td className="mono px-3 py-2">{r.recall === null ? "—" : `${(r.recall * 100).toFixed(0)}%`}</td>
                    <td className="mono px-3 py-2">{r.precision === null ? "—" : `${(r.precision * 100).toFixed(0)}%`}</td>
                    <td className="mono px-3 py-2">{r.specificity === null ? "—" : `${(r.specificity * 100).toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {lastRun && presentes.length > 0 && (
        <section className="card-clinic p-5">
          <h2 className="text-sm font-extrabold">Matriz de confusión</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Filas: etiqueta real · Columnas: predicción del motor.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="text-[11px]">
              <thead>
                <tr>
                  <th className="px-2 py-1.5"><span className="sr-only">Clase real</span></th>
                  {presentes.map((c) => (
                    <th key={c.code} className="px-2 py-1.5 text-left font-bold text-muted-foreground">
                      <span className="block max-w-20 truncate">{c.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {presentes.map((row) => (
                  <tr key={row.code}>
                    <th className="whitespace-nowrap px-2 py-1.5 text-left font-bold">{row.label}</th>
                    {presentes.map((col) => {
                      const v = confusion[row.code]?.[col.code] ?? 0;
                      const hit = row.code === col.code;
                      return (
                        <td key={col.code} className="px-1 py-1">
                          <div
                            className="mono flex h-9 w-14 items-center justify-center rounded-md font-bold"
                            style={{
                              background: v === 0 ? "var(--surface2)" : hit ? "rgba(23,166,115,0.16)" : "rgba(214,69,69,0.14)",
                              color: v === 0 ? "var(--muted-foreground)" : hit ? "var(--ok)" : "var(--danger)",
                            }}
                          >
                            {v}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Historial de corridas</h2>
        {(runs.data ?? []).length === 0 ? (
          <Empty text="Todavía no se ha ejecutado ninguna validación." />
        ) : (
          <ul className="mt-3 divide-y divide-border text-xs">
            {(runs.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <strong className="mono">{(r.accuracy * 100).toFixed(1)}%</strong> · {r.correct}/{r.total} aciertos
                  <span className="ml-2 text-muted-foreground">motor v{r.engineVersion}</span>
                </span>
                <span className="text-muted-foreground">{fmtDate(r.createdAt)} · {r.runBy}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
