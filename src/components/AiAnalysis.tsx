import { RichText } from "@/components/RichText";

type Criterion = {
  criterion_name?: string;
  score?: number;
  max_score?: number;
  comment?: string;
};

type AiAnalysisData = {
  needs_teacher_review?: boolean;
  total_score?: number | null;
  max_score?: number | null;
  criteria_scores?: Criterion[];
  method_correctness?: string;
  calculations?: string;
  units_and_dimensions?: string;
  chemical_rules?: string;
  errors_found?: string[];
  detailed_analysis?: Record<string, unknown> | string;
  feedback?: string;
  recommendations?: string[];
  [key: string]: unknown;
};

const ANALYSIS_LABELS: Record<string, string> = {
  method_correctness: "Корректность метода",
  calculations: "Вычисления",
  units_and_dimensions: "Размерности и единицы",
  chemical_rules: "Химические правила",
  errors_found: "Замечания проверки",
};

export default function AiAnalysis({ data }: { data: AiAnalysisData }) {
  if (!data) return null;

  const total = data.total_score ?? null;
  const max = data.max_score ?? null;
  const criteria = Array.isArray(data.criteria_scores) ? data.criteria_scores : [];
  const errors = Array.isArray(data.errors_found) ? data.errors_found : [];

  return (
    <div className="space-y-6">
      {data.needs_teacher_review === true && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h4 className="font-semibold">Требуется проверка преподавателя</h4>
          <p className="text-sm mt-1">ИИ отметил неоднозначность в решении, условии или эталоне. Указанный балл предварительный — ознакомьтесь с замечаниями ниже.</p>
        </div>
      )}
      {(total !== null || max !== null) && (
        <div>
          <h4 className="font-semibold mb-1">Сводка</h4>
          <p className="text-sm">Балл: {total ?? "—"}{max !== null ? ` / ${max}` : ""}</p>
        </div>
      )}

      {criteria.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Критерии</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4">Критерий</th>
                  <th className="py-2 pr-4">Балл</th>
                  <th className="py-2">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 font-medium">{c.criterion_name || "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{(c.score ?? "—")} / {(c.max_score ?? "—")}</td>
                    <td className="py-2">
                      {c.comment ? <RichText className="text-muted-foreground">{c.comment}</RichText> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data.method_correctness || data.calculations || data.units_and_dimensions || data.chemical_rules) && (
        <div className="grid md:grid-cols-2 gap-4">
          {data.method_correctness && (
            <div>
              <h4 className="font-semibold mb-1">Корректность метода</h4>
              <RichText className="text-sm">{data.method_correctness}</RichText>
            </div>
          )}
          {data.calculations && (
            <div>
              <h4 className="font-semibold mb-1">Вычисления</h4>
              <RichText className="text-sm">{data.calculations}</RichText>
            </div>
          )}
          {data.units_and_dimensions && (
            <div>
              <h4 className="font-semibold mb-1">Размерности и единицы</h4>
              <RichText className="text-sm">{data.units_and_dimensions}</RichText>
            </div>
          )}
          {data.chemical_rules && (
            <div>
              <h4 className="font-semibold mb-1">Химические правила</h4>
              <RichText className="text-sm">{data.chemical_rules}</RichText>
            </div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-red-600">Найденные ошибки</h4>
          <ul className="list-disc list-inside text-sm">
            {errors.map((err, i) => (
              <li key={i}><RichText inline>{err}</RichText></li>
            ))}
          </ul>
        </div>
      )}

      {data.detailed_analysis && (
        <div>
          <h4 className="font-semibold mb-1">Подробный разбор</h4>
          {typeof data.detailed_analysis === "string" ? (
            <RichText className="text-sm">{data.detailed_analysis}</RichText>
          ) : (
            <div className="space-y-2 text-sm">
              {Object.entries(data.detailed_analysis).map(([k, v]) => (
                <div key={k}>
                  <div className="font-medium">{ANALYSIS_LABELS[k] || k}</div>
                  <RichText className="text-muted-foreground">{Array.isArray(v) ? v.join("\n") : String(v)}</RichText>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.feedback && (
        <div>
          <h4 className="font-semibold mb-1">Обратная связь</h4>
          <RichText className="text-sm">{data.feedback}</RichText>
        </div>
      )}

    </div>
  );
}
