import { useEffect, useState } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useAudit, useMe, useSettings, useSetRole, useUpdateSettings, useUsers } from "../queries/admin";
import { Empty, Loader, fmtDate } from "../components/clinic";

export default function AdminPage() {
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const settings = useSettings();
  const users = useUsers(isAdmin);
  const audit = useAudit(isAdmin);
  const setRole = useSetRole();
  const update = useUpdateSettings();

  const [threshold, setThreshold] = useState("0.6");
  const [targetAcc, setTargetAcc] = useState("0.8");
  const [clinic, setClinic] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setThreshold(settings.data.confidence_threshold);
      setTargetAcc(settings.data.accuracy_target);
      setClinic(settings.data.clinic_name);
    }
  }, [settings.data]);

  if (me.isLoading) return <Loader text="Verificando permisos..." />;
  if (!isAdmin)
    return <Empty text="Sección restringida a administradores. Solicite el acceso al responsable del sistema." />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros del motor, gestión de usuarios y bitácora de auditoría.
        </p>
      </header>

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Parámetros clínicos del motor</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div>
            <label className="label-xs" htmlFor="th">
              Umbral de confianza ({Math.round(Number(threshold) * 100)}%)
            </label>
            <input id="th" aria-label="Umbral de confianza" type="range" min={0.3} max={0.95} step={0.01} className="mt-3 w-full accent-primary"
              value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Por debajo de este valor, el resultado se marca <strong>no concluyente</strong>. Subirlo hace al
              sistema más prudente y reduce los falsos positivos.
            </p>
          </div>
          <div>
            <label className="label-xs" htmlFor="ta">
              Objetivo de precisión ({Math.round(Number(targetAcc) * 100)}%)
            </label>
            <input id="ta" aria-label="Objetivo de precision" type="range" min={0.5} max={0.99} step={0.01} className="mt-3 w-full accent-primary"
              value={targetAcc} onChange={(e) => setTargetAcc(e.target.value)} />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Referencia contra la que se compara la precisión medida en el panel de fiabilidad.
            </p>
          </div>
          <div>
            <label className="label-xs" htmlFor="cn">Nombre de la institución</label>
            <input id="cn" aria-label="Nombre de la institucion" className="field mt-1.5" value={clinic} onChange={(e) => setClinic(e.target.value)} />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Aparece en la cabecera de los reportes impresos.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { confidence_threshold: threshold, accuracy_target: targetAcc, clinic_name: clinic },
                { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); } },
              )
            }
          >
            {update.isPending && <LoaderCircle size={16} className="animate-spin" />} Guardar parámetros
          </button>
          {saved && <span className="text-xs font-bold text-ok">Parámetros actualizados.</span>}
        </div>
      </section>

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Usuarios y roles</h2>
        {users.isLoading ? (
          <Loader text="Cargando usuarios..." />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-border bg-surface2">
                <tr className="label-xs">
                  <th className="px-3 py-2.5">Nombre</th>
                  <th className="px-3 py-2.5">Correo</th>
                  <th className="px-3 py-2.5">Alta</th>
                  <th className="px-3 py-2.5">Rol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(users.data ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 font-bold">
                      <span className="flex items-center gap-1.5">
                        {u.role === "admin" && <ShieldCheck size={13} className="text-primary" />}
                        {u.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                    <td className="px-3 py-2">
                      <select
                        aria-label="Rol del usuario"
                        className="field !w-auto !py-1.5 text-xs"
                        value={u.role}
                        disabled={u.id === me.data?.id || setRole.isPending}
                        onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value as "medico" | "admin" })}
                      >
                        <option value="medico">Médico</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-clinic p-5">
        <h2 className="text-sm font-extrabold">Bitácora de auditoría</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Últimas 150 acciones registradas en el sistema.</p>
        {audit.isLoading ? (
          <Loader text="Cargando bitácora..." />
        ) : (audit.data ?? []).length === 0 ? (
          <Empty text="Sin actividad registrada todavía." />
        ) : (
          <ul className="mt-3 max-h-96 divide-y divide-border overflow-auto text-xs">
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <code className="mono rounded bg-surface2 px-1.5 py-0.5 font-bold">{a.action}</code>{" "}
                  <span className="text-muted-foreground">{a.actor}</span>
                  {a.target && <span className="ml-2 mono text-muted-foreground">{a.target}</span>}
                  {a.detail && <span className="ml-2 text-muted-foreground">— {a.detail}</span>}
                </span>
                <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
