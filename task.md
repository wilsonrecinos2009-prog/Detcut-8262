# DET-Cut IA — estado del proyecto

Sistema web de detección temprana de patologías cutáneas con apoyo de IA, en español.
Diseño replicado del prototipo original del proyecto (login split-screen, panel de
diagnóstico, reporte A4 imprimible y recibo tipo ticket térmico).

## Stack
Bun + Vite + React 19 + Wouter + Hono + oRPC + Drizzle/Turso. Puerto web fijo **4200**.

## Clases del motor (7, iguales a las carpetas del dataset)
| código | etiqueta | carpeta dataset |
|---|---|---|
| piel_sana | Piel sana | Piel_Sana |
| queratosis_seborreica | Queratosis seborreica | Seborrheic_Keratosis |
| verrugas_molusco | Verrugas / molusco contagioso | Warts_Molluscum |
| dermatitis_atopica | Dermatitis atópica | Dermatitis_Atopica |
| eczema | Eccema | Eczema |
| psoriasis | Psoriasis | Psoriasis |
| basal | Carcinoma basocelular | Basal |

Cada clase lleva severidad, resumen clínico, medicamentos sugeridos, recomendaciones
y diagnóstico diferencial de referencia (`src/api/analysis/taxonomy.ts`).

## Motor
Panel de 2 lectores de visión en paralelo + tercero de desempate. Prudente por diseño:
por debajo del umbral de confianza (60% configurable en Administración) el resultado se
marca **no concluyente** en vez de inventar patología. "Piel sana" es una respuesta
legítima y frecuente.

## Funcional y verificado
- Login / registro, sesión y roles (admin / médico).
- Panel clínico con métricas, actividad de 30 días y escaneos recientes.
- Nuevo escaneo: archivo, cámara en vivo y capturas del ESP32-CAM (últimas 12 h).
- Resultado en pantalla: confianza, metadatos, resumen, medicamentos, recomendaciones
  y diferencial ponderado con las probabilidades reales del motor.
- Reporte imprimible A4 (`/reporte/:id`) + vista previa e impresión del recibo térmico
  (58/80 mm). Ambos modos verificados generando PDF real desde Chrome.
- Historial con filtros y exportación CSV, fichas de pacientes, fiabilidad del motor
  (set etiquetado + corridas), dispositivos con token y código Arduino, administración
  con parámetros, usuarios y bitácora de auditoría.
- Ingesta del prototipo: `POST /api/ingest/scan` con cabecera `x-device-token`
  (JPEG crudo, multipart o JSON base64) y `GET /api/ingest/ping` como latido.

## Pruebas reales pasadas (motor en vivo)
piel sana 92–95 % · psoriasis 89 % · queratosis seborreica 92 % · carcinoma basocelular 85 %
(+ un caso no concluyente al 28 % correctamente derivado).

## Operación
- Servidor: `bun run dev` (tmux `dev`), puerto 4200.
- Usuario de prueba: prueba@detcut.org / DetCut2026! (admin).
- Umbral de confianza y nombre de la institución se ajustan en Administración.
