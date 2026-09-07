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
