import type { ClassInfo, ScanLike } from "./scan-result";

/**
 * Recibo imprimible estilo ticket térmico, réplica del prototipo original
 * del proyecto (función renderReceipt). Pensado para impresoras de 58/80 mm.
 */
export function Receipt({
  scan,
  info,
  labels,
  patientRef,
}: {
  scan: Pick<
    ScanLike,
    | "id"
    | "code"
    | "diagnosis"
    | "diagnosisCode"
    | "confidence"
    | "conclusive"
    | "createdAt"
    | "imageUrl"
    | "probabilities"
  >;
  info?: ClassInfo;
  labels?: Record<string, string>;
  patientRef?: string | null;
}) {
  const fecha = new Date(scan.createdAt);
  const pct = Math.round(scan.confidence * 100);
  const meds = info?.medications ?? [];
  // El diferencial del ticket usa las probabilidades reales del motor (excluyendo la
  // clase ganadora) y solo cae al diferencial de referencia del catálogo si no hay.
  const medidas = Object.entries(scan.probabilities ?? {})
    .filter(([code, p]) => code !== scan.diagnosisCode && p > 0.01)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, probability]) => ({ code, probability }));
  const diff = medidas.length > 0 ? medidas : info?.differential ?? [];
  const titulo = scan.conclusive ? scan.diagnosis : "RESULTADO NO CONCLUYENTE";

  return (
    <div className="receipt-preview">
      <div className="r-center r-bold" style={{ fontSize: 13, letterSpacing: 2 }}>
        DET-Cut IA
      </div>
      <div className="r-center" style={{ fontSize: 9 }}>
        Diagnostico Dermatologico
      </div>
      <div className="r-dline" />
      <div>FECHA : {fecha.toLocaleDateString("es")}</div>
      <div>HORA&nbsp;&nbsp;: {fecha.toLocaleTimeString("es")}</div>
      <div>REF.&nbsp;&nbsp;: {patientRef || "N/A"}</div>
      <div>ID&nbsp;&nbsp;&nbsp;&nbsp;: {scan.code.toUpperCase()}</div>
      <div className="r-dline" />
      {scan.imageUrl && <img src={scan.imageUrl} className="receipt-img" alt="" />}
      <div className="r-line" />
      <div className="r-center r-bold" style={{ fontSize: 12 }}>
        {titulo.toUpperCase()}
      </div>
      <div className="r-center">
        Confianza: {pct}% · {scan.conclusive ? info?.severity ?? "-" : "Sin severidad"}
      </div>
      <div className="r-line" />
      <div className="r-bold">RESUMEN CLINICO</div>
      <div style={{ fontSize: 9.5, textAlign: "justify" }}>{info?.summary ?? "-"}</div>
      <div className="r-line" />
      <div className="r-bold">MEDICAMENTOS</div>
      {meds.length === 0 ? (
        <div>Ninguno.</div>
      ) : (
        meds.map((m, i) => (
          <div key={m.name}>
            <div>
              <strong>
                {i + 1}. {m.name}
              </strong>
            </div>
            <div>&nbsp;&nbsp;Dosis: {m.dosage}</div>
            <div>&nbsp;&nbsp;{m.purpose}</div>
          </div>
        ))
      )}
      <div className="r-line" />
      <div className="r-bold">RECOMENDACIONES</div>
      <div style={{ fontSize: 9.5, textAlign: "justify" }}>{info?.recommendations ?? "-"}</div>
      {diff.length > 0 && (
        <>
          <div className="r-line" />
          <div className="r-bold">DIAG. DIFERENCIAL</div>
          {diff.map((d) => (
            <div className="r-row" key={d.code}>
              <span>{labels?.[d.code] ?? d.code}</span>
              <span>{Math.round(d.probability * 100)}%</span>
            </div>
          ))}
        </>
      )}
      <div className="r-dline" />
      <div className="r-center" style={{ fontSize: 8.5 }}>
        Reporte generado por IA como APOYO
        <br />
        al diagnostico clinico.
      </div>
      <div className="r-dline" />
      <div className="r-center">*** GRACIAS ***</div>
      <div className="r-center" style={{ fontSize: 8 }}>
        det-cut-ia
      </div>
    </div>
  );
}
