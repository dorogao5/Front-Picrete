// Local visual fixture: npm run dev, then /tests/trainer-ui.html.
// Uses the real trainer component. All requests are intercepted locally;
// no credentials, production API calls, model calls, or writes are possible.
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "../src/components/ui/tooltip";
import CourseTrainer from "../src/pages/CourseTrainer";
import { api } from "../src/lib/api";
import type { Trainer } from "../src/lib/practice";
import "@fontsource/golos-text/400.css";
import "@fontsource/golos-text/500.css";
import "@fontsource/golos-text/600.css";
import "@fontsource/golos-text/700.css";
import "../src/index.css";

const scenarios = [
  { id: "locked", title: "Формальная кинетика и метод начальных скоростей", solved: 0, count: 8 },
  { id: "progress", title: "Уравнение Аррениуса и энергия активации", solved: 2, count: 7 },
  { id: "ready", title: "Кинетика Михаэлиса–Ментен", solved: 3, count: 5 },
  { id: "empty", title: "Подтема без готовых задач", solved: 0, count: 0 },
];
const trainer: Trainer = {
  id: "fixture", source: "studio_fizicheskaya_himiya", published: true, revision: 1, release_id: "fixture",
  definition: {
    title: "Физическая химия — тренажёр задач",
    description: "Локальная проверка интерфейса. Генерация и проверка решений не вызываются.",
    sections: scenarios.map((s) => ({ id: s.id, title: s.title, target: 3,
      items: Array.from({ length: s.count }, (_, i) => ({ task_id: `${s.id}-${i}`, difficulty: "easy" })) })),
  },
  generation_unlock: Object.fromEntries(scenarios.map((s) => [s.id, s.solved >= 3])),
  generation_progress: Object.fromEntries(scenarios.map((s) => [s.id, { solved: s.solved, required: 3 }])),
  progress: scenarios.map((s) => ({ section_id: s.id, difficulty: "easy", solved: s.solved, independent: s.solved })),
};
api.defaults.adapter = async (config) => {
  if (config.method === "get" && config.url?.endsWith("/practice/catalog/fixture")) {
    return { data: trainer, status: 200, statusText: "OK", headers: {}, config };
  }
  throw new Error("Локальный UI-пример: сетевые действия отключены.");
};
createRoot(document.getElementById("root")!).render(
  <MemoryRouter initialEntries={["/c/fixture/trainer/course/fixture"]}>
    <TooltipProvider delayDuration={150}>
      <Routes><Route path="/c/:courseId/trainer/course/:trainerId" element={<CourseTrainer />} /></Routes>
    </TooltipProvider>
  </MemoryRouter>,
);
