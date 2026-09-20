import { useState } from "react";
import { Camera, Cpu, LoaderCircle, Upload, X } from "lucide-react";
import {
  useAnalyze,
  useAnalyzeCamera,
  useDeviceFeed,
  useTaxonomy,
  uploadImage,
} from "../queries/scans";
import { usePatients, useAssignScan } from "../queries/patients";
import { CameraCapture } from "../components/camera-capture";
import { ScanResult, type ScanLike } from "../components/scan-result";
import { Empty, Loader, TriageBadge, fmtDate } from "../components/clinic";

type Modo = "archivo" | "camara" | "dispositivo";

export default function ScanPage() {
  const [modo, setModo] = useState<Modo>("archivo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [bodySite, setBodySite] = useState("");
  const [patientId, setPatientId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ScanLike | null>(null);

  const taxonomy = useTaxonomy();
  const patients = usePatients();
  const analyze = useAnalyze();
  const analyzeCamera = useAnalyzeCamera();
  const assign = useAssignScan();
  const feed = useDeviceFeed(modo === "dispositivo");

  const labels = Object.fromEntries((taxonomy.data?.classes ?? []).map((c) => [c.code, c.label]));
  const threshold = taxonomy.data?.threshold ?? 0.6;
  const busy = uploading || analyze.isPending || analyzeCamera.isPending;

  function pick(f: File | null) {
    setFile(f);
    setError(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  /** Descarta la imagen elegida por error y deja el selector limpio. */
  function quitarImagen() {
    pick(null);
    setResult(null);
    const input = document.getElementById("file");
    if (input instanceof HTMLInputElement) input.value = "";
  }

  const commonInput = () => ({
    patientId: patientId ? Number(patientId) : null,
    patientRef: patients.data?.find((p) => String(p.id) === patientId)?.ref ?? null,
    bodySite: bodySite || null,
    notes: notes || null,
  });

  async function analizarArchivo() {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setUploading(true);
      const imageKey = await uploadImage(file);
      setUploading(false);
      const scan = await analyze.mutateAsync({ imageKey, source: "web", ...commonInput() });
      setResult(scan as ScanLike);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el análisis.");
    } finally {
      setUploading(false);
    }
  }

  async function analizarCaptura(dataUrl: string) {
    setError(null);
    setResult(null);
    try {
      const scan = await analyzeCamera.mutateAsync({ dataUrl, ...commonInput() });
      setResult(scan as ScanLike);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el análisis.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Nuevo escaneo</h1>
        <p className="text-sm text-muted-foreground">
          Suba una imagen, capture con la cámara o reciba la captura del prototipo ESP32-CAM.
        </p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,380px)_1fr]">
        <section className="card-clinic space-y-4 p-5">
          <div>
            <div className="card-label">Nuevo escaneo</div>
            <div className="card-title">Analizar lesión</div>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface2 p-1">
            {([
              ["archivo", "Archivo", Upload],
              ["camara", "Cámara", Camera],
              ["dispositivo", "ESP32-CAM", Cpu],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-bold transition ${
                  modo === id ? "bg-surface text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {modo === "archivo" && (
            <div className="space-y-3">
              <div className="relative">
                <label htmlFor="file" className="upload-zone">
                  {preview ? (
                    <img src={preview} alt="Vista previa" className="mx-auto max-h-52 rounded-lg object-contain" />
                  ) : (
                    <>
                      <div className="upload-icon">
                        <Upload size={20} />
                      </div>
                      <p>Arrastra o haz clic aquí</p>
                      <span>JPG, PNG · desde cámara o prototipo</span>
                    </>
                  )}
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={quitarImagen}
                    disabled={busy}
                    aria-label="Quitar imagen"
                    title="Quitar imagen"
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white transition hover:bg-black/80 disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <input
                id="file"
                aria-label="Seleccionar imagen"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              {file && <p className="mono truncate text-[11px] text-muted-foreground">{file.name}</p>}
            </div>
          )}

          {modo === "camara" && <CameraCapture onCapture={analizarCaptura} busy={busy} />}

          {modo === "dispositivo" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Capturas recibidas del prototipo en las últimas 12 horas. Se actualiza automáticamente.
              </p>
              {feed.isLoading ? (
                <Loader text="Escuchando el dispositivo..." />
              ) : (feed.data ?? []).length === 0 ? (
                <Empty text="Sin capturas del dispositivo todavía. Verifique el token en Dispositivos." />
              ) : (
                <ul className="space-y-2">
                  {(feed.data ?? []).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setResult(s as ScanLike)}
                        className={`recent-item w-full text-left ${result?.id === s.id ? "active" : ""}`}
                      >
                        <span className="recent-thumb">
                          <img src={s.imageUrl} alt="" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{s.diagnosis}</span>
                          <span className="mono block text-[10px] text-muted-foreground">{fmtDate(s.createdAt)}</span>
                        </span>
                        <TriageBadge triage={s.triage} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <label className="label-xs" htmlFor="site">Zona anatómica</label>
              <input id="site" aria-label="Zona anatomica" className="field mt-1.5" value={bodySite} placeholder="Ej. antebrazo derecho"
                onChange={(e) => setBodySite(e.target.value)} />
            </div>
            <div>
              <label className="label-xs" htmlFor="pat">Paciente (opcional)</label>
              <select id="pat" className="field mt-1.5" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                <option value="">Sin asignar</option>
                {(patients.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.ref} — {p.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-xs" htmlFor="notes">Notas clínicas</label>
              <textarea id="notes" aria-label="Notas clinicas" rows={2} className="field mt-1.5" value={notes}
                placeholder="Tiempo de evolución, síntomas, cambios recientes..."
                onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {modo === "archivo" && (
            <button type="button" className="btn-primary w-full" onClick={analizarArchivo} disabled={!file || busy}>
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {uploading ? "Subiendo imagen..." : analyze.isPending ? "Analizando con el panel de modelos..." : "Analizar imagen"}
            </button>
          )}

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
              {error}
            </p>
          )}
        </section>

        <section className="min-w-0">
          {busy && !result && (
            <div className="card-clinic flex flex-col items-center justify-center gap-3 p-12 text-center">
              <LoaderCircle size={26} className="animate-spin text-primary" />
              <p className="text-sm font-bold">Analizando la imagen</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Varios modelos de visión evalúan la lesión de forma independiente y sus votos se combinan.
                El proceso tarda entre 10 y 30 segundos.
              </p>
            </div>
          )}

          {!busy && !result && (
            <div className="card-clinic p-8 text-center">
              <p className="text-sm font-bold">Sin análisis en curso</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                El resultado aparecerá aquí con la clase detectada, la confianza, el semáforo de urgencia y la
                conducta recomendada. Si la confianza es insuficiente, el sistema lo declarará no concluyente
                en lugar de arriesgar un diagnóstico.
              </p>
            </div>
          )}

          {result && (
            <ScanResult
              scan={result}
              labels={labels}
              threshold={threshold}
              classes={taxonomy.data?.classes}
              actions={
                patientId && !result.patientRef ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={assign.isPending}
                    onClick={async () => {
                      const scan = await assign.mutateAsync({ scanId: result.id, patientId: Number(patientId) });
                      setResult({ ...result, patientRef: scan.patientRef });
                    }}
                  >
                    Asignar a paciente seleccionado
                  </button>
                ) : null
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
