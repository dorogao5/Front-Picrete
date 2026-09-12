export interface BankFilters {
  q: string;
  task_type: string;
  difficulty: string;
  volume: string;
  has_solution: "all" | "yes" | "no";
}
export const emptyBankFilters: BankFilters = { q: "", task_type: "", difficulty: "", volume: "", has_solution: "all" };
export const bankFilterParams = (value: BankFilters) => ({
  q: value.q.trim() || undefined,
  task_type: value.task_type || undefined,
  difficulty: value.difficulty || undefined,
  volume: value.volume || undefined,
  has_solution: value.has_solution === "all" ? undefined : value.has_solution === "yes",
});
export const bankLabel = (value: string) => ({
  качественное: "Качественное", расчетное: "Расчётное", теория: "Теория",
  уравнения_реакций: "Уравнения реакций", вывод_формулы: "Вывод формулы",
  комбинированное: "Комбинированное", анализ_рисунка: "Анализ рисунка",
  легкая: "Лёгкая", средняя: "Средняя", сложная: "Сложная",
  короткое: "Короткое", среднее: "Среднее", длинное: "Длинное",
}[value] ?? value);

export type BankFacet = "task_type" | "difficulty" | "volume";
const sourceLabels: Record<BankFacet, Record<string, string>> = {
  task_type: { calculation: "Расчётное", qualitative: "Качественное", theory: "Теория" },
  difficulty: { easy: "Базовый", medium: "Средний", hard: "Сложный" },
  volume: { short: "Короткий", medium: "Средний", long: "Длинный" },
};
export const bankFacetLabel = (field: BankFacet, value: string) =>
  sourceLabels[field][value] ?? bankLabel(value);

// Preserve source values for API queries, including unfamiliar classifications.
export const bankFacetOptions = (field: BankFacet, values: string[] = []) => {
  const order = field === "difficulty"
    ? ["easy", "легкая", "medium", "средняя", "hard", "сложная"]
    : field === "volume" ? ["short", "короткое", "medium", "среднее", "long", "длинное"] : [];
  const rank = (value: string) => order.includes(value) ? order.indexOf(value) : order.length;
  return [...new Set(values)].filter(Boolean).sort((a, b) => rank(a) - rank(b));
};
