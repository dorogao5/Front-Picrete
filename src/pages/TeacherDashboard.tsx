import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Bot, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { examsAPI, getApiErrorStatus } from "@/lib/api";
import type { WorkKind } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ExamSummary {
  id: string;
  title: string;
  kind: WorkKind;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  status: string;
  task_count: number;
  student_count: number;
  pending_count: number;
}

const SkeletonCard = () => (
  <Card className="animate-pulse p-6">
    <div className="h-5 w-1/3 rounded bg-muted" />
    <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
  </Card>
);

const TeacherDashboard = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | WorkKind>("all");
  const [publishingExamId, setPublishingExamId] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }
      try {
        const response = await examsAPI.list(courseId);
        setExams(response.data.items);
      } catch (error: unknown) {
        if (getApiErrorStatus(error) === 401) {
          setLoading(false);
          return;
        }
        toast.error("Не удалось загрузить работы — обновите страницу");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [courseId]);

  if (!courseId) {
    return null;
  }

  const handlePublishExam = async (examId: string) => {
    if (!courseId) return;
    setPublishingExamId(examId);
    try {
      await examsAPI.publish(examId, courseId);
      const response = await examsAPI.list(courseId);
      setExams(response.data.items);
      toast.success("Работа опубликована — студенты её видят");
    } catch {
      toast.error("Не удалось опубликовать работу");
    } finally {
      setPublishingExamId(null);
    }
  };

  const filteredExams =
    kindFilter === "all" ? exams : exams.filter((exam) => exam.kind === kindFilter);

  const stats = {
    total: filteredExams.length,
    active: filteredExams.filter((e) => e.status === "active" || e.status === "published").length,
    pendingReview: filteredExams.reduce((sum, e) => sum + e.pending_count, 0),
    completed: filteredExams.reduce((sum, e) => sum + (e.student_count - e.pending_count), 0),
  };

  const statCards = [
    { label: "Всего работ", value: stats.total },
    { label: "Активных", value: stats.active },
    { label: "Ждут проверки", value: stats.pendingReview, highlight: stats.pendingReview > 0 },
    { label: "Проверено решений", value: stats.completed },
  ];

  return (
    <PageShell
      title="Работы курса"
      subtitle="Создание контрольных и домашних, проверка решений"
      actions={
        <>
          <Link to={`/c/${courseId}/task-bank`}>
            <Button variant="outline" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Банк задач
            </Button>
          </Link>
          <Link to={`/c/${courseId}/assistant`}>
            <Button variant="outline" className="gap-1.5">
              <Bot className="h-4 w-4" />
              Ассистент
            </Button>
          </Link>
          <Link to={`/c/${courseId}/create-exam`}>
            <Button variant="accent" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Создать работу
            </Button>
          </Link>
        </>
      }
    >
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className={cn("p-5", stat.highlight && "border-warning/50")}>
            <p
              className={cn(
                "font-display text-3xl font-semibold",
                stat.highlight && "text-warning"
              )}
            >
              {loading ? "…" : stat.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="mb-6 inline-flex rounded-md border bg-muted/60 p-0.5">
        {([
          ["all", "Все"],
          ["control", "Контрольные"],
          ["homework", "Домашние"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant="ghost"
            className={cn("h-8", kindFilter === value && "bg-card shadow-soft")}
            onClick={() => setKindFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Работ пока нет"
          description="Создайте первую контрольную или домашнюю работу — задачи можно взять из банка."
          action={
            <Link to={`/c/${courseId}/create-exam`}>
              <Button variant="accent" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Создать работу
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredExams.map((exam) => (
            <Card key={exam.id} className="p-5 transition-shadow hover:shadow-elegant">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{exam.title}</h3>
                    <StatusBadge domain="workKind" value={exam.kind} />
                    <StatusBadge domain="exam" value={exam.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span>
                      {new Date(exam.start_time).toLocaleDateString("ru-RU", {
                        timeZone: "Europe/Moscow",
                      })}
                    </span>
                    <span>Задач: {exam.task_count}</span>
                    <span>Сдали: {exam.student_count}</span>
                    {exam.pending_count > 0 && (
                      <span className="font-medium text-warning">
                        Ждут проверки: {exam.pending_count}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exam.status === "draft" && (
                    <Button
                      variant="accent"
                      onClick={() => handlePublishExam(exam.id)}
                      disabled={publishingExamId === exam.id}
                    >
                      {publishingExamId === exam.id ? "Публикуем..." : "Опубликовать"}
                    </Button>
                  )}
                  <Link to={`/c/${courseId}/exam/${exam.id}/submissions`}>
                    <Button variant="outline">
                      Решения
                      {exam.pending_count > 0 && (
                        <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-warning">
                          {exam.pending_count}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Link to={`/c/${courseId}/exam/${exam.id}/edit`}>
                    <Button variant="ghost">Изменить</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default TeacherDashboard;
