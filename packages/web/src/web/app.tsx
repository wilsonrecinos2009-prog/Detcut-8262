import { Redirect, Route, Switch, useLocation } from "wouter";
import { Provider } from "./components/provider";
import { Layout } from "./components/layout";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import { authClient } from "./lib/auth";

import LoginPage from "./pages/login";
import DashboardPage from "./pages/index";
import ScanPage from "./pages/scan";
import PatientsPage from "./pages/patients";
import PatientPage from "./pages/patient";
import HistoryPage from "./pages/history";
import ReportPage from "./pages/report";
import ValidationPage from "./pages/validation";
import DevicesPage from "./pages/devices";
import AdminPage from "./pages/admin";

function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--clinic-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--clinic-primary)] border-t-transparent" />
        <p className="text-sm text-slate-500">Cargando DET-Cut IA…</p>
      </div>
    </div>
  );
}

function Routes() {
  const { data: session, isPending } = authClient.useSession();
  const [location] = useLocation();

  if (isPending) return <Booting />;

  if (!session?.user) {
    if (location === "/login") return <LoginPage />;
    return <Redirect to="/login" />;
  }

  if (location === "/login") return <Redirect to="/" />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/escaneo" component={ScanPage} />
        <Route path="/pacientes" component={PatientsPage} />
        <Route path="/pacientes/:id" component={PatientPage} />
        <Route path="/historial" component={HistoryPage} />
        <Route path="/reporte/:id" component={ReportPage} />
        <Route path="/fiabilidad" component={ValidationPage} />
        <Route path="/dispositivos" component={DevicesPage} />
        <Route path="/admin" component={AdminPage} />
        <Route>
          <div className="p-10 text-center text-slate-500">
            <p className="text-lg font-semibold text-slate-700">Página no encontrada</p>
            <p className="mt-1 text-sm">La ruta solicitada no existe en el sistema.</p>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <Provider>
      <Routes />
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
