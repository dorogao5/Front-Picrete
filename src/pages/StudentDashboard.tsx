import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Bot, Calendar, CheckCircle, Clock, Dumbbell, ScanText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { examsAPI, getApiErrorStatus, submissionsAPI } from "@/lib/api";
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
}

interface StudentSubmission {
  id: string;
  session_id: string;
  exam_id: string;
  exam_title: string;
  exam_kind?: WorkKind | null;
  submitted_at: string;
  status: string;
  ocr_overall_status?:
    | "not_required"
    | "pending"
    | "processing"
    | "in_review"
    | "validated"
    | "reported"
    | "failed"
    | null;
  llm_precheck_status?: "skipped" | "queued" | "processing" | "completed" | "failed" | null;
  report_flag?: boolean;
  ai_score: number | null;
  final_score: number | null;
  max_score: number;
  teacher_comments: string | null;
}

const SkeletonCard = () => (
  <Card className="animate-pulse p-6">
    <div className="h-5 w-1/3 rounded bg-muted" />
    <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
  </Card>
);

const StudentDashboard = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | WorkKind>("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }
      try {
        const [examsResponse, submissionsResponse] = await Promise.all([
          examsAPI.list(courseId),
          submissionsAPI.mySubmissions(courseId),
        ]);
        setExams(examsResponse.data.items);
        setSubmissions(submissionsResponse.data.items);
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

    fetchData();
  }, [courseId]);

  if (!courseId) {
    return null;
  }

  const submittedExamIds = new Set(submissions.map((s) => s.exam_id));
  const now = new Date();
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));

  const upcomingExams = exams.filter(
    (exam) =>
      !submittedExamIds.has(exam.id) && (exam.status === "published" || exam.status === "active")
  );

  const completedSubmissions = submissions.filter((s) => s.id != null);
  const withResolvedKind = completedSubmissions.map((submission) => {
    const kind = submission.exam_kind ?? examsById.get(submission.exam_id)?.kind ?? null;
    return { ...submission, exam_kind: kind };
  });

  const filteredUpcoming =
    kindFilter === "all" ? upcomingExams : upcomingExams.filter((exam) => exam.kind === kindFilter);
  const filteredCompleted =
    kindFilter === "all"
      ? withResolvedKind
      : withResolvedKind.filter((submission) => submission.exam_kind === kindFilter);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" }),
      time: date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }),
    };
  };

  const averageScore =
    completedSubmissions.length > 0
      ? completedSubmissions.reduce((sum, s) => {
          const score = s.final_score !== null ? s.final_score : s.ai_score || 0;
          const percentage = s.max_score > 0 ? (score / s.max_score) * 100 : 0;
          return sum + percentage;
        }, 0) / completedSubmissions.length
      : null;

  const stats = [
    { label: "Предстоящих работ", value: loading ? "…" : String(filteredUpcoming.length) },
    { label: "Сдано работ", value: loading ? "…" : String(filteredCompleted.length) },
    {
      label: "Средний результат",
      value: loading ? "…" : averageScore === null ? "—" : `${averageScore.toFixed(0)}%`,
    },
  ];

  return (
    <PageShell
      title="Мои работы"
      subtitle="Расписание контрольных и домашних, результаты проверок"
      actions={
        <>
          <Link to={`/c/${courseId}/task-bank`}>
            <Button variant="outline" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              Банк задач
            </Button>
          </Link>
          <Link to={`/c/${courseId}/trainer`}>
            <Button variant="outline" className="gap-1.5">
              <Dumbbell className="h-4 w-4" />
              Тренажёры
            </Button>
          </Link>
          <Link to={`/c/${courseId}/assistant`}>
            <Button variant="accent" className="gap-1.5">
              <Bot className="h-4 w-4" />
              Ассистент
            </Button>
          </Link>
        </>
      }
    >
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="font-display text-3xl font-semibold">{stat.value}</p>
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

      <section className="mb-10">
        <h2 className="section-rule mb-4 text-xl font-semibold">Предстоящие работы</h2>
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Предстоящих работ нет"
            description="Когда преподаватель опубликует новую работу, она появится здесь."
          />
        ) : (
          <div className="space-y-3">
            {filteredUpcoming.map((exam) => {
              const { date, time } = formatDateTime(exam.start_time);
              const startTime = new Date(exam.start_time);
              const endTime = new Date(exam.end_time);
              const isAvailable = now >= startTime && now <= endTime;
              const isExpired = now > endTime;

              return (
                <Card
                  key={exam.id}
                  className={cn(
                    "p-5 transition-shadow hover:shadow-elegant",
                    isAvailable && "border-accent/40"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{exam.title}</h3>
                        <StatusBadge domain="workKind" value={exam.kind} />
                        {isAvailable && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                            Идёт сейчас
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {date}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {time}
                          {exam.kind === "control" && exam.duration_minutes
                            ? ` · ${exam.duration_minutes} мин`
                            : " · до дедлайна"}
                        </span>
                        {isExpired && <span className="font-medium text-destructive">Время истекло</span>}
                      </div>
                    </div>
                    {isAvailable ? (
                      <Link to={`/c/${courseId}/exam/${exam.id}`}>
                        <Button variant="accent">Начать работу</Button>
                      </Link>
                    ) : (
                      <Button disabled variant="outline">
                        {now < startTime ? "Ещё не началась" : "Завершена"}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-rule mb-4 text-xl font-semibold">Сданные работы</h2>
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
          </div>
        ) : filteredCompleted.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="Сданных работ пока нет"
            description="После сдачи первой работы здесь появятся результаты проверки."
          />
        ) : (
          <div className="space-y-3">
            {filteredCompleted.map((submission) => {
              const score =
                submission.final_score !== null ? submission.final_score : submission.ai_score;
              const needsOcrReview = submission.ocr_overall_status === "in_review";
              const detailsHref = needsOcrReview
                ? `/c/${courseId}/exam/${submission.session_id}/ocr-review`
                : `/c/${courseId}/exam/${submission.session_id}/result`;

              return (
                <Card
                  key={submission.id}
                  className={cn(
                    "p-5 transition-shadow hover:shadow-elegant",
                    needsOcrReview && "border-warning/50"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{submission.exam_title}</h3>
                        <StatusBadge domain="workKind" value={submission.exam_kind} />
                        {needsOcrReview ? (
                          <StatusBadge domain="ocr" value="in_review" />
                        ) : (
                          <StatusBadge domain="submission" value={submission.status} />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          Сдана{" "}
                          {new Date(submission.submitted_at).toLocaleDateString("ru-RU", {
                            timeZone: "Europe/Moscow",
                          })}
                        </span>
                        {score !== null && (
                          <span className="font-medium text-foreground">
                            {score.toFixed(1)} / {submission.max_score}
                            {submission.max_score > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {((score / submission.max_score) * 100).toFixed(0)}%
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link to={detailsHref}>
                      {needsOcrReview ? (
                        <Button variant="accent" className="gap-1.5">
                          <ScanText className="h-4 w-4" />
                          Проверить распознавание
                        </Button>
                      ) : (
                        <Button variant="outline">Результат</Button>
                      )}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
};

export default StudentDashboard;
