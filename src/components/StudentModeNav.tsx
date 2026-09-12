import { BookOpenText, ClipboardCheck, Dumbbell } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { hasCourseRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

const modes = [
  {
    id: "learn",
    label: "Изучать",
    description: "Ассистент курса",
    icon: BookOpenText,
    path: "assistant",
  },
  {
    id: "practice",
    label: "Тренироваться",
    description: "Практика с ИИ",
    icon: Dumbbell,
    path: "trainer",
  },
  {
    id: "exam",
    label: "Работы",
    description: "ДЗ, КР и результаты",
    icon: ClipboardCheck,
    path: "student",
  },
] as const;

export function StudentModeNav() {
  const { courseId } = useParams<{ courseId?: string }>();
  const location = useLocation();

  if (!courseId || !hasCourseRole(courseId, "student")) return null;

  const courseRoot = `/c/${courseId}`;
  const isStudentExamResultPath =
    location.pathname.startsWith(`${courseRoot}/exam/`) &&
    (location.pathname.endsWith("/result") || location.pathname.endsWith("/ocr-review"));
  const isStudentSurface =
    location.pathname === `${courseRoot}/student` ||
    location.pathname.startsWith(`${courseRoot}/assistant`) ||
    location.pathname.startsWith(`${courseRoot}/trainer`) ||
    location.pathname.startsWith(`${courseRoot}/task-bank`) ||
    isStudentExamResultPath;

  if (!isStudentSurface) return null;

  const activeMode = location.pathname.includes("/assistant")
    ? "learn"
    : location.pathname.includes("/trainer") || location.pathname.includes("/task-bank")
      ? "practice"
      : "exam";

  return (
    <nav aria-label="Режим обучения" className="mb-7 overflow-x-auto rounded-lg border bg-card/80 p-1 shadow-soft">
      <div className="grid min-w-[20rem] grid-cols-3 gap-1">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = mode.id === activeMode;
          return (
            <Link
              key={mode.id}
              to={`/c/${courseId}/${mode.path}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-foreground text-background shadow-soft"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
              <span className="text-left">
                <span className="block font-medium leading-tight">{mode.label}</span>
                <span className={cn("hidden text-[11px] leading-tight sm:block", active ? "text-background/70" : "text-muted-foreground")}>
                  {mode.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
