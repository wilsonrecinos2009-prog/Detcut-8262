import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

/** Captura en vivo desde la cámara del equipo. Devuelve un JPEG en dataURL. */
export function CameraCapture({
  onCapture,
  busy,
}: {
  onCapture: (dataUrl: string) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  }

  function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.92));
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-foreground/90">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted aria-label="Vista previa de la camara" className="h-full w-full object-cover" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
            <CameraOff size={28} />
            <span className="text-xs">Cámara apagada</span>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-full border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!active ? (
          <button type="button" className="btn-primary" onClick={start}>
            <Camera size={16} /> Encender cámara
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={shoot} disabled={busy}>
              {busy ? <RefreshCw size={16} className="animate-spin" /> : <Camera size={16} />}
              {busy ? "Analizando..." : "Capturar y analizar"}
            </button>
            <button type="button" className="btn-ghost" onClick={stop}>
              <CameraOff size={16} /> Apagar
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Encuadre la lesión dentro del círculo, con luz uniforme y a unos 10-15 cm de distancia. Evite el
        reflejo directo del flash.
      </p>
    </div>
  );
}
