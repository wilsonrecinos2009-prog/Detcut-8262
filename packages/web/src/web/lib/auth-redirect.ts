import { authClient } from "./auth";

// Completa el retorno del login gestionado (Google) antes de que se monte la app.
// Se ejecuta como top-level await para que la sesión ya exista en el primer render.
await authClient.managedAuth.handleRedirect();
