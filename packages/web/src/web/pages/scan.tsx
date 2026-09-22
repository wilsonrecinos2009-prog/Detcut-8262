import { useState } from "react";
import { Camera, Cpu, LoaderCircle, Upload, X } from "lucide-react";
import {
  useAnalyze,
  useAnalyzeCamera,
  useDeviceFeed,
  useScans,
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const taxonomy = useTaxonomy();
  const patients = usePatients();
  const analyze = useAnalyze();
  const analyzeCamera = useAnalyzeCamera();
  const assign = useAssignScan();
  const feed = useDeviceFeed(modo === "dispositivo");
  const scans = useScans();

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
      setSelectedId(null);
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
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el análisis.");
    }
  }

  const recentList = (scans.data ?? []).slice(0, 20);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: "20px",
        minHeight: "calc(100vh - 140px)",
      }}
    >
      {/* ── SIDEBAR IZQUIERDA ── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Card análisis */}
        <div className="card-clinic" style={{ padding: "18px" }}>
          <div className="card-label">Nuevo escaneo</div>
          <div className="card-title" style={{ marginBottom: "14px" }}>Analizar lesión</div>

          {/* Selector de paciente */}
          <select
            className="field"
            style={{ marginBottom: "12px" }}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Ref. paciente (opcional)</option>
            {(patients.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.ref} — {p.fullName}</option>
            ))}
          </select>

          {/* Tabs modo */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "4px",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "4px",
              marginBottom: "12px",
            }}
          >
            {([
              ["archivo", "Archivo", Upload],
              ["camara", "Cámara", Camera],
              ["dispositivo", "ESP32", Cpu],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "7px 4px",
                  border: "none",
                  borderRadius: "7px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: modo === id ? "var(--surface)" : "transparent",
                  color: modo === id ? "var(--primary)" : "var(--muted-foreground)",
                  boxShadow: modo === id ? "0 1px 4px rgba(22,50,74,0.14)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Zona subida */}
          {modo === "archivo" && (
            <div style={{ position: "relative", marginBottom: "12px" }}>
              <label htmlFor="file" className="upload-zone">
                {preview ? (
                  <img src={preview} alt="Vista previa" style={{ maxHeight: "160px", width: "100%", objectFit: "cover", borderRadius: "8px" }} />
                ) : (
                  <>
                    <div className="upload-icon"><Upload size={20} /></div>
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
                  style={{
                    position: "absolute", top: "8px", right: "8px",
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)", border: "none",
                    color: "#fff", cursor: "pointer", display: "grid", placeItems: "center",
                  }}
                >
                  <X size={13} />
                </button>
              )}
              <input id="file" type="file" accept="image/*" className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {modo === "camara" && (
            <div style={{ marginBottom: "12px" }}>
              <CameraCapture onCapture={analizarCaptura} busy={busy} />
            </div>
          )}

          {modo === "dispositivo" && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", color: "var(--muted-foreground)", marginBottom: "8px" }}>
                Capturas del ESP32-CAM en las últimas 12 horas.
              </p>
              {feed.isLoading ? (
                <Loader text="Escuchando dispositivo..." />
              ) : (feed.data ?? []).length === 0 ? (
                <Empty text="Sin capturas del dispositivo todavía." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(feed.data ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setResult(s as ScanLike); setSelectedId(s.id); }}
                      className={`recent-item ${selectedId === s.id ? "active" : ""}`}
                    >
                      <span className="recent-thumb"><img src={s.imageUrl} alt="" /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.diagnosis}</span>
                        <span style={{ display: "block", fontSize: "10px", color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{fmtDate(s.createdAt)}</span>
                      </span>
                      <TriageBadge triage={s.triage} size="sm" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zona anatómica y notas */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label className="label-xs" htmlFor="site">Zona anatómica</label>
              <input id="site" className="field" style={{ marginTop: "6px" }} value={bodySite}
                placeholder="Ej. antebrazo derecho" onChange={(e) => setBodySite(e.target.value)} />
            </div>
            <div>
              <label className="label-xs" htmlFor="notes">Notas clínicas</label>
              <textarea id="notes" rows={2} className="field" style={{ marginTop: "6px" }} value={notes}
                placeholder="Tiempo de evolución, síntomas..." onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {modo === "archivo" && (
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={analizarArchivo}
              disabled={!file || busy}
            >
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {uploading ? "Subiendo..." : analyze.isPending ? "Analizando..." : "▶ Analizar imagen"}
            </button>
          )}

          {error && (
            <p style={{ marginTop: "10px", padding: "10px 14px", background: "rgba(214,69,69,0.1)", border: "1px solid rgba(214,69,69,0.3)", borderRadius: "8px", fontSize: "12px", color: "var(--danger)", fontWeight: 600 }}>
              {error}
            </p>
          )}
        </div>

        {/* Card historial reciente */}
        <div className="card-clinic" style={{ padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <div className="card-label">Diagnósticos recientes</div>
              <div className="card-title">Historial</div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }}>
              {recentList.length}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "340px", overflowY: "auto" }}>
            {scans.isLoading ? (
              <Loader text="Cargando..." />
            ) : recentList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted-foreground)", fontSize: "12px" }}>
                Aún no hay diagnósticos.
              </div>
            ) : (
              recentList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setResult(s as ScanLike); setSelectedId(s.id); setFile(null); setPreview(null); }}
                  className={`recent-item ${selectedId === s.id ? "active" : ""}`}
                >
                  <span className="recent-thumb">
                    {s.imageUrl ? <img src={s.imageUrl} alt="" /> : "🔬"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.conclusive ? (labels[s.diagnosisCode] ?? s.diagnosis) : "No concluyente"}
                    </span>
                    <span style={{ display: "block", fontSize: "11px", color: "var(--muted-foreground)" }}>
                      {(s.confidence * 100).toFixed(0)}% · {s.patientRef ?? "Sin ref."}
                    </span>
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--muted-foreground)" }}>
                    {new Date(s.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ── PANEL DERECHO ── */}
      <main>
        {busy && !result && (
          <div className="card-clinic" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "60px", textAlign: "center", minHeight: "500px" }}>
            <LoaderCircle size={26} className="animate-spin" style={{ color: "var(--primary)" }} />
            <p style={{ fontWeight: 700 }}>Analizando la imagen</p>
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", maxWidth: "300px", lineHeight: 1.6 }}>
              El modelo de IA está procesando la lesión cutánea. Esto puede tardar entre 10 y 30 segundos.
            </p>
          </div>
        )}

        {!busy && !result && (
          <div
            style={{
              display: "grid", placeItems: "center",
              minHeight: "500px",
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--radius)",
              textAlign: "center", padding: "40px",
            }}
          >
            <div>
              <div style={{ width: "56px", height: "56px", background: "var(--surface2)", borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 16px", fontSize: "24px" }}>🔬</div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Sin diagnóstico seleccionado</h2>
              <p style={{ color: "var(--muted-foreground)", fontSize: "13px", maxWidth: "300px", lineHeight: 1.6 }}>
                Sube una imagen de la lesión cutánea o selecciona un diagnóstico del historial para ver el reporte completo.
              </p>
            </div>
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
      </main>
    </div>
  );
}
