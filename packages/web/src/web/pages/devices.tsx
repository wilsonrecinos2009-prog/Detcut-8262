import { useState } from "react";
import { Check, Copy, Cpu, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  useCreateDevice,
  useDeleteDevice,
  useDevices,
  useRotateToken,
  useSetDeviceActive,
} from "../queries/devices";
import { Empty, Loader, fmtDate } from "../components/clinic";

export default function DevicesPage() {
  const devices = useDevices();
  const create = useCreateDevice();
  const rotate = useRotateToken();
  const setActive = useSetDeviceActive();
  const remove = useDeleteDevice();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "https://tu-dominio";
  const primerToken = devices.data?.[0]?.token ?? "dct_TOKEN_DEL_DISPOSITIVO";

  function copiar(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Dispositivos de captura</h1>
        <p className="text-sm text-muted-foreground">
          Registre cada ESP32-CAM y use su token para enviar imágenes al motor.
        </p>
      </header>

      <form
        className="card-clinic flex flex-wrap items-end gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate(
            { name: name.trim(), location: location || null },
            { onSuccess: () => { setName(""); setLocation(""); } },
          );
        }}
      >
        <div className="min-w-48 flex-1">
          <label className="label-xs" htmlFor="dn">Nombre del dispositivo</label>
          <input id="dn" aria-label="Nombre del dispositivo" className="field mt-1.5" placeholder="ESP32-CAM consultorio 1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-48 flex-1">
          <label className="label-xs" htmlFor="dl">Ubicación</label>
          <input id="dl" aria-label="Ubicacion del dispositivo" className="field mt-1.5" placeholder="Sala de dermatología" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          {create.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Registrar
        </button>
      </form>

      {devices.isLoading ? (
        <Loader text="Cargando dispositivos..." />
      ) : (devices.data ?? []).length === 0 ? (
        <Empty text="Sin dispositivos registrados. Registre el prototipo para recibir sus capturas." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(devices.data ?? []).map((d) => (
            <div key={d.id} className="card-clinic p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-dim text-primary">
                    <Cpu size={17} />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">{d.location || "Sin ubicación"}</p>
                  </div>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={{
                    background: d.online ? "rgba(23,166,115,0.12)" : "var(--muted)",
                    color: d.online ? "var(--ok)" : "var(--muted-foreground)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.online ? "var(--ok)" : "var(--muted-foreground)" }} />
                  {d.online ? "En línea" : "Sin conexión"}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface2 px-2.5 py-2">
                <code className="mono flex-1 truncate text-[11px]">{d.token}</code>
                <button type="button" className="text-muted-foreground transition hover:text-primary" onClick={() => copiar(d.token, `t${d.id}`)}>
                  {copied === `t${d.id}` ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>Capturas: <strong className="mono text-foreground">{d.captureCount}</strong></span>
                <span>Última señal: <strong className="text-foreground">{fmtDate(d.lastSeenAt)}</strong></span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => rotate.mutate({ id: d.id })}>
                  <RefreshCw size={13} /> Rotar token
                </button>
                <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => setActive.mutate({ id: d.id, active: !d.active })}>
                  {d.active ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1.5 text-xs !text-danger"
                  onClick={() => { if (confirm(`¿Eliminar ${d.name}?`)) remove.mutate({ id: d.id }); }}
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Integración del prototipo ESP32-CAM</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          El dispositivo envía la foto por HTTP con su token en la cabecera <code className="mono">X-Device-Token</code>.
          El sistema responde con el diagnóstico y el escaneo aparece en el panel.
        </p>

        <div className="mt-4 space-y-3 text-xs">
          <Endpoint method="POST" path="/api/ingest/scan" desc="Envía el JPEG (cuerpo crudo, multipart o JSON base64) y devuelve el resultado." />
          <Endpoint method="GET" path="/api/ingest/ping" desc="Latido para marcar el dispositivo como en línea." />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="label-xs">Código Arduino (ESP32-CAM + AI Thinker)</p>
            <button type="button" className="btn-ghost !py-1.5 text-xs" onClick={() => copiar(arduino(base, primerToken), "code")}>
              {copied === "code" ? <Check size={13} /> : <Copy size={13} />} Copiar
            </button>
          </div>
          <pre className="mono mt-2 max-h-96 overflow-auto rounded-lg border border-border bg-surface2 p-4 text-[11px] leading-relaxed">
            {arduino(base, primerToken)}
          </pre>
        </div>
      </section>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2">
      <span className="mono rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{method}</span>
      <code className="mono font-bold">{path}</code>
      <span className="text-muted-foreground">{desc}</span>
    </div>
  );
}

function arduino(base: string, token: string) {
  return `#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// --- Configuración ---
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASS = "TU_CONTRASENA";
const char* SERVIDOR   = "${base}/api/ingest/scan";
const char* TOKEN      = "${token}";
const char* ZONA       = "antebrazo derecho";   // zona anatomica opcional

// Pines del modelo AI Thinker
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM   0
#define SIOD_GPIO_NUM  26
#define SIOC_GPIO_NUM  27
#define Y9_GPIO_NUM    35
#define Y8_GPIO_NUM    34
#define Y7_GPIO_NUM    39
#define Y6_GPIO_NUM    36
#define Y5_GPIO_NUM    21
#define Y4_GPIO_NUM    19
#define Y3_GPIO_NUM    18
#define Y2_GPIO_NUM     5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM  23
#define PCLK_GPIO_NUM  22
#define BOTON_GPIO     13   // pulsador a GND para disparar la captura

void iniciarCamara() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;   config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;   config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;   config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;   config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;   config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM; config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM; config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_SVGA;  // 800x600: buen detalle sin saturar la red
  config.jpeg_quality = 10;              // menor numero = mejor calidad
  config.fb_count     = 1;
  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Error al iniciar la camara");
    ESP.restart();
  }
}

void enviarCaptura() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) { Serial.println("Fallo la captura"); return; }

  HTTPClient http;
  String url = String(SERVIDOR) + "?body_site=" + ZONA;
  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Token", TOKEN);
  http.setTimeout(60000);   // el analisis puede tardar ~30 s

  int codigo = http.POST(fb->buf, fb->len);
  if (codigo > 0) {
    Serial.println("Respuesta del sistema:");
    Serial.println(http.getString());   // {"diagnostico":"Piel sana","confianza":0.94,...}
  } else {
    Serial.printf("Error HTTP: %s\\n", http.errorToString(codigo).c_str());
  }
  http.end();
  esp_camera_fb_return(fb);
}

void setup() {
  Serial.begin(115200);
  pinMode(BOTON_GPIO, INPUT_PULLUP);
  iniciarCamara();
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println("\\nWiFi conectado. Pulse el boton para analizar.");
}

void loop() {
  if (digitalRead(BOTON_GPIO) == LOW) {
    Serial.println("Capturando y enviando...");
    enviarCaptura();
    delay(1500);   // antirrebote
  }
  delay(50);
}`;
}
