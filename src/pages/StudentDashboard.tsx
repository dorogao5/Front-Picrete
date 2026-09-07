import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, CheckCircle, Clock, ScanText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { InlineError } from "@/components/InlineError";
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
  task_count?: number;
}

interface StudentSubmission {
  id: string | null;
  session_id: string;
  exam_id: string;
  exam_title: string;
  exam_kind?: WorkKind | null;
  submitted_at: string | null;
  status: string | null;
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
  max_score: number | null;
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
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [kindFilter, setKindFilter] = useState<"all" | WorkKind>("all");
  const [examToStart, setExamToStart] = useState<ExamSummary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }
      setDataError("");
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
        setDataError("Не удалось загрузить расписание и результаты. Проверьте соединение и повторите запрос.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId, reloadKey]);

  if (!courseId) {
    return null;
  }

  if (!loading && dataError) {
    return (
      <PageShell title="Экзамены и задания" subtitle="Сроки, активные попытки и результаты проверки">
        <InlineError description={dataError} onRetry={() => setReloadKey((value) => value + 1)} />
      </PageShell>
    );
  }

  const submittedExamIds = new Set(
    submissions.filter((submission) => submission.id !== null).map((submission) => submission.exam_id),
  );
  const now = new Date();
  const examsById = new Map(exams.map((exam) => [exam.id, exam]));

  const upcomingExams = exams.filter(
    (exam) =>
      !submittedExamIds.has(exam.id) && (exam.status === "published" || exam.status === "active")
  );

  const completedSubmissions = submissions.filter(
    (submission): submission is StudentSubmission & {
      id: string;
      submitted_at: string;
      status: string;
      max_score: number;
    } =>
      submission.id !== null &&
      submission.submitted_at !== null &&
      submission.status !== null &&
      submission.max_score !== null,
  );
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

  const scoredSubmissions = completedSubmissions.filter(
    (submission) => submission.final_score !== null || submission.ai_score !== null,
  );
  const averageScore =
    scoredSubmissions.length > 0
      ? scoredSubmissions.reduce((sum, s) => {
          const score = s.final_score !== null ? s.final_score : (s.ai_score ?? 0);
          const percentage = s.max_score > 0 ? (score / s.max_score) * 100 : 0;
          return sum + percentage;
        }, 0) / scoredSubmissions.length
      : null;

  const stats = [
    {
      label: "Впереди",
      value: loading
        ? "…"
        : String(upcomingExams.filter((exam) => new Date(exam.end_time) >= now).length),
    },
    { label: "Сдано", value: loading ? "…" : String(completedSubmissions.length) },
    {
      label: "Средний балл",
      value: loading ? "…" : averageScore === null ? "—" : `${averageScore.toFixed(0)}%`,
    },
  ];

  return (
    <PageShell
      title="Экзамены и задания"
      subtitle="Сроки, активные попытки и результаты проверки — время указано по Москве"
    >
      <div className="mb-8 grid grid-cols-3 gap-2 sm:gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-3 sm:p-5">
            <p className="font-display text-2xl font-semibold sm:text-3xl">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
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
            aria-pressed={kindFilter === value}
          >
            {label}
          </Button>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="section-rule mb-4 text-xl font-semibold">Расписание работ</h2>
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Работ по этому фильтру нет"
            description="Когда преподаватель опубликует новую работу, она появится в расписании."
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
                        {exam.task_count !== undefined && <span>Заданий: {exam.task_count}</span>}
                        {isExpired && <span className="font-medium text-destructive">Время истекло</span>}
                      </div>
                    </div>
                    {isAvailable ? (
                      exam.kind === "control" ? (
                        <Button variant="accent" onClick={() => setExamToStart(exam)}>
                          Правила и вход
                        </Button>
                      ) : (
                        <Button variant="accent" onClick={() => navigate(`/c/${courseId}/exam/${exam.id}`)}>
                          Открыть задание
                        </Button>
                      )
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

      <AlertDialog open={Boolean(examToStart)} onOpenChange={(open) => !open && setExamToStart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              Перед началом контрольной
            </AlertDialogTitle>
            <AlertDialogDescription>
              При первой попытке таймер запускается после входа и продолжает идти, даже если закрыть вкладку. Уже начатая попытка откроется с оставшимся временем.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {examToStart && (
            <dl className="grid gap-3 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Длительность</dt>
                <dd className="font-medium">
                  {examToStart.duration_minutes
                    ? `До ${examToStart.duration_minutes} мин, но не позже общего дедлайна`
                    : "До общего дедлайна"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Окончание окна</dt>
                <dd className="font-medium">
                  {new Date(examToStart.end_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ответ</dt>
                <dd className="font-medium">Фото решения в JPEG или PNG</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Когда время закончится</dt>
                <dd className="font-medium">Сохранённые страницы отправятся автоматически</dd>
              </div>
            </dl>
          )}
          <p className="text-sm text-muted-foreground">
            Во время выполнения эталонные ответы и разбор не показываются. Перед сдачей проверьте порядок и читаемость всех страниц.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => examToStart && navigate(`/c/${courseId}/exam/${examToStart.id}`)}
            >
              Начать или продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default StudentDashboard;
