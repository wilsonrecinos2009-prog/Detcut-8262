import { useState } from "react";
import { Link } from "wouter";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { useCreatePatient, usePatients } from "../queries/patients";
import { Empty, Loader, fmtDay } from "../components/clinic";

export default function PatientsPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ref: "",
    fullName: "",
    birthDate: "",
    sex: "",
    phototype: "",
    phone: "",
    email: "",
    notes: "",
  });

  const patients = usePatients(q || undefined);
  const create = useCreatePatient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        ...form,
        birthDate: form.birthDate || null,
        sex: form.sex || null,
        phototype: form.phototype || null,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      setOpen(false);
      setForm({ ref: "", fullName: "", birthDate: "", sex: "", phototype: "", phone: "", email: "", notes: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el paciente.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            Fichas clínicas y seguimiento de lesiones en el tiempo.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
          <Plus size={16} /> Nuevo paciente
        </button>
      </header>

      {open && (
        <form onSubmit={submit} className="card-clinic grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Referencia *" value={form.ref} onChange={(v) => setForm({ ...form, ref: v })} placeholder="PAC-001" required />
          <Input label="Nombre completo *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} placeholder="Ana Martínez Ruiz" required />
          <Input label="Fecha de nacimiento" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} type="date" />
          <Select label="Sexo" value={form.sex} onChange={(v) => setForm({ ...form, sex: v })}
            options={["", "Femenino", "Masculino", "Otro"]} />
          <Select label="Fototipo (Fitzpatrick)" value={form.phototype} onChange={(v) => setForm({ ...form, phototype: v })}
            options={["", "I", "II", "III", "IV", "V", "VI"]} />
          <Input label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label-xs" htmlFor="notes">Antecedentes relevantes</label>
            <textarea id="notes" aria-label="Antecedentes relevantes" className="field mt-1.5" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Antecedentes de cáncer de piel, exposición solar, inmunosupresión..." />
          </div>
          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger sm:col-span-2 lg:col-span-3">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending && <LoaderCircle size={16} className="animate-spin" />} Guardar paciente
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input className="field !pl-9" aria-label="Buscar pacientes" placeholder="Buscar por nombre o referencia" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {patients.isLoading ? (
        <Loader text="Cargando pacientes..." />
      ) : (patients.data ?? []).length === 0 ? (
        <Empty text="Aún no hay pacientes registrados." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(patients.data ?? []).map((p) => (
            <Link key={p.id} to={`/pacientes/${p.id}`} className="card-clinic block p-4 transition hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{p.fullName}</p>
                  <p className="mono text-[11px] text-muted-foreground">{p.ref}</p>
                </div>
                {p.redFlags > 0 && (
                  <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                    {p.redFlags} urgente{p.redFlags > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <span className="text-muted-foreground">Escaneos: <strong className="mono text-foreground">{p.scanCount}</strong></span>
                <span className="text-muted-foreground">Fototipo: <strong className="text-foreground">{p.phototype || "—"}</strong></span>
                <span className="col-span-2 text-muted-foreground">Último análisis: <strong className="text-foreground">{fmtDay(p.lastScanAt)}</strong></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <input className="field mt-1.5" aria-label={label} type={type} value={value} placeholder={placeholder} required={required}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="label-xs">{label}</label>
      <select className="field mt-1.5" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </div>
  );
}
