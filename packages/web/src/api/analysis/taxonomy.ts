/**
 * Taxonomía clínica del motor DET-Cut IA.
 *
 * Las clases son exactamente las del set de datos del proyecto (carpetas EUREKA/dataset):
 * Basal, Dermatitis_Atopica, Eczema, Piel_Sana, Psoriasis, Seborrheic_Keratosis,
 * Warts_Molluscum. `datasetFolder` mantiene la correspondencia con el nombre de la
 * carpeta para que las métricas y un futuro entrenamiento usen las mismas etiquetas.
 *
 * `piel_sana` es una clase de primera categoría: el motor debe poder afirmar
 * activamente que no hay hallazgo patológico, no solo "descartar" enfermedades.
 *
 * El contenido clínico (severidad, resumen, medicamentos sugeridos, recomendaciones y
 * diagnóstico diferencial) proviene del prototipo original del proyecto, para que el
 * reporte impreso sea el mismo que ya validó el equipo.
 */

export type Nature = "sana" | "benigna" | "premaligna" | "maligna" | "inflamatoria" | "infecciosa";
export type Triage = "verde" | "ambar" | "rojo";
export type Severity = "Normal" | "Leve" | "Moderada" | "Severa";

export type Medication = {
  name: string;
  dosage: string;
  purpose: string;
};

export type ClassDef = {
  code: string;
  label: string;
  /** Carpeta equivalente en el set de datos etiquetado. */
  datasetFolder: string;
  nature: Nature;
  severity: Severity;
  /** Peso con que la clase aporta al riesgo de malignidad (0-1). */
  malignancyWeight: number;
  baseTriage: Triage;
  /** Signos visibles que describen la clase (se inyecta al prompt del motor). */
  description: string;
  /** Resumen clínico divulgativo para el reporte. */
  summary: string;
  /** Conducta recomendada (línea principal del reporte). */
  recommendation: string;
  /** Medicamentos sugeridos como referencia, nunca como prescripción. */
  medications: Medication[];
  /** Cuidados y medidas no farmacológicas. */
  recommendations: string;
  /** Diagnóstico diferencial de referencia del prototipo. */
  differential: { code: string; probability: number }[];
};

export const CLASSES: ClassDef[] = [
  {
    code: "piel_sana",
    label: "Piel sana",
    datasetFolder: "Piel_Sana",
    nature: "sana",
    severity: "Normal",
    malignancyWeight: 0,
    baseTriage: "verde",
    description:
      "No se identifican signos de patología cutánea. Coloración, textura, bordes y patrón pigmentario dentro de la variación normal.",
    summary:
      "No se detecta ninguna patología cutánea con nivel de certeza suficiente en la imagen analizada. La piel presenta color uniforme, textura normal y ausencia de lesión focal.",
    recommendation:
      "Sin hallazgos que requieran intervención. Mantener fotoprotección diaria y autoexploración mensual.",
    medications: [],
    recommendations:
      "No se requiere tratamiento en este momento. Si aparece picor, enrojecimiento, sangrado o cambios en una lesión, consulte a un médico. Para un diagnóstico definitivo consulte siempre a un dermatólogo.",
    differential: [],
  },
  {
    code: "queratosis_seborreica",
    label: "Queratosis seborreica",
    datasetFolder: "Seborrheic_Keratosis",
    nature: "benigna",
    severity: "Leve",
    malignancyWeight: 0.05,
    baseTriage: "verde",
    description:
      "Lesión benigna de aspecto verrucoso, superficie cérea con apariencia de estar 'pegada' sobre la piel, bordes bien delimitados.",
    summary:
      "La queratosis seborreica es un crecimiento cutáneo benigno, no canceroso, muy frecuente a partir de la edad media. Se presenta como lesiones de color marrón o negro con superficie verrucosa. No requiere tratamiento salvo que resulte molesta.",
    recommendation:
      "Benigna. Solo requiere tratamiento por motivo estético o irritación mecánica. Control si cambia de aspecto, sangra o crece con rapidez.",
    medications: [
      {
        name: "Ácido tricloroacético 35%",
        dosage: "Aplicación clínica única",
        purpose: "Cauterización química de la lesión",
      },
      {
        name: "Peróxido de hidrógeno 40%",
        dosage: "Aplicación clínica",
        purpose: "Tratamiento aprobado para queratosis seborreica",
      },
    ],
    recommendations:
      "No es necesario tratamiento si no molesta. Evitar rascarse. Consultar si la lesión cambia de tamaño, forma o color.",
    differential: [
      { code: "basal", probability: 0.08 },
      { code: "verrugas_molusco", probability: 0.12 },
    ],
  },
  {
    code: "verrugas_molusco",
    label: "Verrugas / molusco contagioso",
    datasetFolder: "Warts_Molluscum",
    nature: "infecciosa",
    severity: "Leve",
    malignancyWeight: 0.02,
    baseTriage: "verde",
    description:
      "Pápulas de origen vírico: verrugas de superficie rugosa y queratósica, o molusco contagioso con pápulas cupuliformes y umbilicación central.",
    summary:
      "Infección vírica de la piel. Las verrugas presentan superficie rugosa y queratósica; el molusco contagioso se manifiesta como pequeñas protuberancias redondas con una depresión central. Se transmite por contacto directo y por autoinoculación.",
    recommendation:
      "Lesión benigna contagiosa. Valoración clínica para tratamiento (crioterapia, curetaje o tópicos) y medidas para evitar autoinoculación y contagio.",
    medications: [
      {
        name: "Imiquimod crema 5%",
        dosage: "3 veces por semana",
        purpose: "Estimula el sistema inmune para eliminar el virus",
      },
      {
        name: "Ácido salicílico 17%",
        dosage: "1 vez/día",
        purpose: "Destruye el tejido infectado localmente",
      },
    ],
    recommendations:
      "Evitar tocar o rascar las lesiones. No compartir toallas ni artículos personales. Las lesiones suelen desaparecer solas en 6-12 meses.",
    differential: [
      { code: "queratosis_seborreica", probability: 0.1 },
      { code: "eczema", probability: 0.07 },
    ],
  },
  {
    code: "dermatitis_atopica",
    label: "Dermatitis atópica",
    datasetFolder: "Dermatitis_Atopica",
    nature: "inflamatoria",
    severity: "Moderada",
    malignancyWeight: 0.02,
    baseTriage: "ambar",
    description:
      "Placas eritematosas mal delimitadas con sequedad, descamación, liquenificación y excoriaciones por rascado, en zonas de flexión de forma característica.",
    summary:
      "La dermatitis atópica es una enfermedad inflamatoria crónica de la piel que suele comenzar en la infancia. Se caracteriza por piel seca, picor intenso y lesiones eccematosas. Tiene una base genética importante.",
    recommendation:
      "Valoración clínica para tratamiento tópico e identificación de desencadenantes. Cuidado de la barrera cutánea con emolientes y reevaluación en 4 semanas.",
    medications: [
      {
        name: "Mometasona furoato 0.1%",
        dosage: "1 vez/día",
        purpose: "Corticosteroide tópico de potencia media",
      },
      {
        name: "Cetirizina 10 mg",
        dosage: "Noche",
        purpose: "Antihistamínico para el picor nocturno",
      },
      {
        name: "Dupilumab 300 mg",
        dosage: "Cada 2 semanas (inyección)",
        purpose: "Biológico de primera línea para casos moderados-severos",
      },
    ],
    recommendations:
      "Rutina diaria de hidratación con emolientes ricos. Usar ropa suave de algodón. Mantener temperatura ambiental fresca. Control periódico con dermatólogo.",
    differential: [
      { code: "eczema", probability: 0.25 },
      { code: "psoriasis", probability: 0.1 },
    ],
  },
  {
    code: "eczema",
    label: "Eccema",
    datasetFolder: "Eczema",
    nature: "inflamatoria",
    severity: "Leve",
    malignancyWeight: 0.02,
    baseTriage: "ambar",
    description:
      "Lesión inflamatoria aguda o subaguda: eritema, vesículas, exudación o costras con descamación, de bordes difusos y a menudo pruriginosa.",
    summary:
      "El eccema hace que la piel se inflame y enrojezca, en general como respuesta a desencadenantes ambientales o alérgicos. Se caracteriza por picor intenso, sequedad y formación de costras.",
    recommendation:
      "Valoración clínica para tratamiento antiinflamatorio tópico y estudio del agente irritante o alérgeno de contacto. Reevaluar en 4 semanas.",
    medications: [
      {
        name: "Hidrocortisona crema 1%",
        dosage: "2-3 veces/día",
        purpose: "Alivia la inflamación y el picor",
      },
      {
        name: "Tacrolimus ungüento 0.1%",
        dosage: "2 veces/día",
        purpose: "Inmunomodulador tópico para zonas sensibles",
      },
      {
        name: "Loratadina 10 mg",
        dosage: "1 vez/día",
        purpose: "Antihistamínico para reducir el picor",
      },
    ],
    recommendations:
      "Bañarse con agua tibia y durante poco tiempo. Aplicar crema hidratante inmediatamente después del baño. Usar jabones sin fragancia. Evitar telas sintéticas.",
    differential: [
      { code: "dermatitis_atopica", probability: 0.2 },
      { code: "psoriasis", probability: 0.15 },
    ],
  },
  {
    code: "psoriasis",
    label: "Psoriasis",
    datasetFolder: "Psoriasis",
    nature: "inflamatoria",
    severity: "Moderada",
    malignancyWeight: 0.02,
    baseTriage: "ambar",
    description:
      "Placas eritematosas bien delimitadas cubiertas de escama gruesa blanco-nacarada, de distribución simétrica en zonas de extensión.",
    summary:
      "La psoriasis es una enfermedad crónica de la piel que provoca la acumulación rápida de células cutáneas, formando escamas y manchas rojas que pueden picar o doler. Es una condición autoinmune y no es contagiosa.",
    recommendation:
      "Derivar a valoración dermatológica para tratamiento y estudio de afectación articular o comorbilidad asociada.",
    medications: [
      {
        name: "Betametasona crema 0.1%",
        dosage: "2 veces/día",
        purpose: "Reduce la inflamación y el enrojecimiento local",
      },
      {
        name: "Calcipotriol pomada",
        dosage: "1-2 veces/día",
        purpose: "Regula el crecimiento de las células de la piel",
      },
      {
        name: "Metotrexato 7.5 mg",
        dosage: "Semanal",
        purpose: "Medicamento sistémico para casos moderados-severos",
      },
    ],
    recommendations:
      "Mantener la piel hidratada con emolientes sin fragancia. Evitar el estrés y los traumatismos en la piel. No rascar las lesiones. Consultar al dermatólogo para tratamiento sistémico si las lesiones son extensas.",
    differential: [
      { code: "dermatitis_atopica", probability: 0.12 },
      { code: "eczema", probability: 0.08 },
    ],
  },
  {
    code: "basal",
    label: "Carcinoma basocelular",
    datasetFolder: "Basal",
    nature: "maligna",
    severity: "Severa",
    malignancyWeight: 0.85,
    baseTriage: "rojo",
    description:
      "Pápula perlada con telangiectasias, bordes elevados y posible ulceración o costra central; crecimiento lento y local, típico en zona fotoexpuesta.",
    summary:
      "El carcinoma basocelular es el tipo más común de cáncer de piel. Raramente se propaga a otros órganos, pero REQUIERE ATENCIÓN MÉDICA URGENTE. La exposición prolongada al sol es el principal factor de riesgo.",
    recommendation:
      "DERIVACIÓN PRIORITARIA a dermatología para dermatoscopia, biopsia confirmatoria y tratamiento quirúrgico. No demorar.",
    medications: [
      {
        name: "Imiquimod crema 5%",
        dosage: "5 veces/semana durante 6 semanas",
        purpose: "Para lesiones superficiales pequeñas",
      },
      {
        name: "Vismodegib 150 mg",
        dosage: "1 vez/día (oral)",
        purpose: "Inhibidor de la vía Hedgehog para casos avanzados",
      },
    ],
    recommendations:
      "REFERIR AL DERMATÓLOGO DE INMEDIATO. El tratamiento principal es la extirpación quirúrgica. Usar protector solar SPF 50+ diariamente y revisar el resto de la superficie cutánea.",
    differential: [
      { code: "queratosis_seborreica", probability: 0.15 },
      { code: "psoriasis", probability: 0.06 },
    ],
  },
];

export const CLASS_CODES = CLASSES.map((c) => c.code);
export const HEALTHY = "piel_sana";
export const byCode = (code: string) => CLASSES.find((c) => c.code === code);
export const labelOf = (code: string) => byCode(code)?.label ?? code;

export const MALIGNANT_CODES = CLASSES.filter((c) => c.nature === "maligna").map((c) => c.code);
export const PREMALIGNANT_CODES = CLASSES.filter((c) => c.nature === "premaligna").map((c) => c.code);
