import { createGateway } from "ai";

/**
 * Compatibilidad de formato de imagen con el gateway.
 *
 * El SDK (`ai` 7.0.x) serializa las partes de tipo `file` como
 *   { type: "file", mediaType, data: { type: "data", data: "<base64>" } }
 * mientras que el gateway espera la base64 plana:
 *   { type: "file", mediaType, data: "<base64>" }
 * Con el objeto anidado responde 400 "Invalid input" y ninguna lectura de imagen
 * llega al modelo. Aplanamos la carga justo antes de enviarla.
 */
function flattenFileParts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(flattenFileParts);
  if (value === null || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) out[key] = flattenFileParts(val);

  if (out.type === "file" && out.data !== null && typeof out.data === "object") {
    const nested = out.data as Record<string, unknown>;
    if (nested.type === "data" && typeof nested.data === "string") out.data = nested.data;
  }
  return out;
}

async function gatewayFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  if (init?.body && typeof init.body === "string") {
    try {
      const patched = flattenFileParts(JSON.parse(init.body));
      init = { ...init, body: JSON.stringify(patched) };
    } catch {
      // Cuerpo no JSON: se envía tal cual.
    }
  }
  return fetch(input, init);
}

export const gateway = createGateway({
  baseURL: process.env.AI_GATEWAY_BASE_URL,
  apiKey: process.env.AI_GATEWAY_API_KEY,
  fetch: gatewayFetch as typeof fetch,
});
