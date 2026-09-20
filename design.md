# DET-Cut IA — Design

Sistema de apoyo al diagnóstico dermatológico: un médico (o un dispositivo ESP32-CAM) envía una imagen de piel, el motor de IA la clasifica entre 6 patologías cutáneas + **piel sana**, entrega un nivel de confianza, un semáforo de urgencia y un reporte clínico imprimible. Solo web (panel clínico de escritorio); el móvil se puede añadir después sobre el mismo backend.

Dirección visual: **azul clínico, limpio, denso en datos, cero decoración**. Se conserva la identidad del prototipo original del usuario (#2f7de6 sobre fondo #f4f8fc, Inter + JetBrains Mono para cifras y códigos). Sensación de instrumento médico, no de landing page: tarjetas de borde fino, tipografía compacta, números monoespaciados, mucho contraste en los estados críticos.

## Brand & Colors

CSS variables en `packages/web/src/web/styles.css` (tema claro único — un panel clínico se usa con luz de consultorio).

| Token | Valor | Uso |
|-------|-------|-----|
| background | #f4f8fc | Fondo de página |
| surface | #ffffff | Tarjetas, paneles |
| surface2 | #f5f9ff | Zonas internas, tablas alternas |
| border | #dce7f2 | Hairlines |
| primary | #2f7de6 | Acciones, marca, foco |
| primary-dim | rgba(47,125,230,0.12) | Fondos suaves de énfasis |
| foreground | #16324a | Texto principal |
| muted | #6d7b8a | Texto secundario, etiquetas |
| ok | #17a673 | Piel sana / semáforo verde |
| warning | #c97a00 | Semáforo ámbar / baja confianza |
| danger | #d64545 | Semáforo rojo / derivación urgente |

Semáforo de urgencia: `verde` = control rutinario, `ámbar` = revisión dermatológica 4–6 semanas, `rojo` = derivación urgente. Nunca se usa rojo como decoración.

## Typography

- **Display + body**: Inter (400/500/600/700/800), vía Google Fonts.
- **Mono**: JetBrains Mono — porcentajes de confianza, IDs de escaneo, matriz de confusión, tokens de dispositivo.
- Escala compacta: base 14px, títulos 20–42px, etiquetas 11–12px en mayúsculas con `letter-spacing: 0.5px`.

## Pages & Screens

- **Login/Registro** (`pages/login.tsx`) — split screen: izquierda marca + capacidades, derecha tabs Iniciar sesión / Registrarse + Google.
- **Dashboard** (`pages/index.tsx`) — KPIs (escaneos, % piel sana, casos rojos, fiabilidad vigente), últimos escaneos, estado del dispositivo.
- **Nuevo escaneo** (`pages/scan.tsx`) — cámara en vivo, subida de archivo o captura recibida del ESP32-CAM; control de calidad de imagen; resultado con probabilidades por clase, ABCDE, semáforo y confianza.
- **Pacientes** (`pages/patients.tsx`) y **Ficha** (`pages/patient.tsx`) — datos del paciente, lesiones, línea de tiempo por lesión con comparativa de fotos y evolución del riesgo.
- **Historial** (`pages/history.tsx`) — tabla filtrable + export CSV.
- **Reporte** (`pages/report.tsx`) — hoja clínica A4 imprimible / PDF.
- **Fiabilidad** (`pages/validation.tsx`) — set de prueba etiquetado, accuracy global vs objetivo 80%, sensibilidad/especificidad por clase, matriz de confusión.
- **Admin** (`pages/admin.tsx`) — usuarios y roles, dispositivos ESP32-CAM y tokens, umbrales del motor, guía de integración del hardware.

## Key User Flows

1. **Escaneo manual**: login → Nuevo escaneo → cámara/archivo → control de calidad → análisis (consenso de 2 pases) → resultado + semáforo → asignar a paciente/lesión → reporte PDF.
2. **Escaneo por hardware**: ESP32-CAM `POST /api/ingest/scan` con `X-Device-Token` → análisis en servidor → aparece en vivo en el panel (polling 3 s) → el médico lo revisa y confirma.
3. **Validación**: admin carga casos etiquetados → ejecuta el set → métricas y matriz de confusión → ajusta umbral de confianza.

## Architecture

- **API**: oRPC en `packages/web/src/api/routes/` (scans, patients, devices, validation, admin, upload) + rutas HTTP planas para Better Auth y la ingesta del dispositivo.
- **Motor**: `src/api/analysis/` — control de calidad, prompt clínico, consenso multi-modelo vía AI gateway, calibración y umbral.
- **Auth**: Better Auth (email/contraseña + Google gestionado), roles `medico` / `admin`.
- **Almacenamiento**: imágenes en Tigris S3, URLs prefirmadas.
- **Estado**: TanStack Query con hooks en `src/web/queries/`.
