// Entry point referenced by index.html — composition only, real bootstrap
// lives in __main.tsx (template-managed).
// El import de auth-redirect va primero: su top-level await resuelve el retorno
// del login gestionado antes de que el bootstrap monte la app.
import "./lib/auth-redirect";
import "./__main";
