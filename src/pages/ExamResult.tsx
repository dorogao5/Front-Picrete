import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, FileText, Lightbulb, RefreshCw, ScanText, XCircle } from "lucide-react";

import { PageShell, PageLoader } from "@/components/PageShell";
import { InlineError } from "@/components/InlineError";
import { RichText } from "@/components/RichText";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getApiErrorMessage, submissionsAPI } from "@/lib/api";
import AiAnalysis from "@/components/AiAnalysis";

interface SubmissionScore {
  criterion_name: string;
  criterion_description?: string | null;
  ai_score: number | null;
  final_score: number | null;
  max_score: number;
  teacher_comment?: string | null;
  ai_comment?: string | null;
}

interface SubmissionExamInfo {
  id: string;
  title?: string;
  max_attempts: number;
  kind?: "control" | "homework";
  end_time?: string;
}

interface SubmissionSessionInfo {
  attempt_number: number;
  total_attempts: number;
}

interface SubmissionResult {
  submitted_at: string;
  status: string;
  /** Explicit release gate in the current API; omitted by older deployments. */
  feedback_released?: boolean;
  ocr_overall_status:
    | "not_required"
    | "pending"
    | "processing"
    | "in_review"
    | "validated"
    | "reported"
    | "failed";
  llm_precheck_status: "skipped" | "queued" | "processing" | "completed" | "failed";
  report_flag: boolean;
  report_summary?: string | null;
  ocr_error?: string | null;
  llm_error?: string | null;
  ai_score: number | null;
  final_score: number | null;
  max_score: number;
  ai_comments?: string | null;
  teacher_comments?: string | null;
  scores?: SubmissionScore[];
  ai_analysis?: Record<string, unknown> & { recommendations?: string[] };
  is_flagged: boolean;
  flag_reasons: string[];
  exam?: SubmissionExamInfo;
  session?: SubmissionSessionInfo;
}

const ExamResult = () => {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const submissionStatus = submission?.status;
  const submissionOcrStatus = submission?.ocr_overall_status;

  useEffect(() => {
    const loadResult = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await submissionsAPI.getResult(sessionId!, courseId);
        setSubmission(response.data as SubmissionResult);
      } catch (error: unknown) {
        setLoadError(getApiErrorMessage(error, "Не удалось загрузить результат"));
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      loadResult();
    }
  }, [courseId, reloadKey, sessionId]);

  useEffect(() => {
    if (!sessionId || !submissionStatus || !submissionOcrStatus) {
      return;
    }

    const ocrReviewPath = courseId ? `/c/${courseId}/exam/${sessionId}/ocr-review` : "/dashboard";

    if (submissionOcrStatus === "in_review") {
      navigate(ocrReviewPath, { replace: true });
      return;
    }

    const shouldPoll =
      submissionStatus === "processing" ||
      submissionOcrStatus === "pending" ||
      submissionOcrStatus === "processing";
    if (!shouldPoll) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await submissionsAPI.getResult(sessionId, courseId);
        const next = response.data as SubmissionResult;
        setSubmission(next);
        if (next.ocr_overall_status === "in_review") {
          navigate(ocrReviewPath, { replace: true });
        }
      } catch {
        // keep polling silently until processing settles
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [courseId, navigate, sessionId, submissionOcrStatus, submissionStatus]);

  if (loading) {
    return (
      <PageShell title="Результат работы">
        <PageLoader label="Загружаем результат..." />
      </PageShell>
    );
  }

  if (!submission) {
    return (
      <PageShell title="Результат работы">
        {loadError ? (
          <InlineError description={loadError} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <EmptyState
            icon={XCircle}
            title="Результат не найден"
            description="Возможно, работа ещё не была сдана."
            action={
              <Link to={courseId ? `/c/${courseId}/student` : "/dashboard"}>
                <Button variant="outline">К списку работ</Button>
              </Link>
            }
          />
        )}
      </PageShell>
    );
  }

  const displayScore = submission.final_score ?? submission.ai_score;
  const scorePercent =
    submission.max_score > 0 && displayScore !== null
      ? (displayScore / submission.max_score) * 100
      : 0;

  const retakeContext =
    submission.exam && submission.session
      ? {
          examId: submission.exam.id,
          maxAttempts: submission.exam.max_attempts,
          totalAttempts: submission.session.total_attempts,
        }
      : null;

  const canRetake =
    submission.status === "approved" &&
    retakeContext !== null &&
    retakeContext.totalAttempts < retakeContext.maxAttempts;

  const remainingAttempts = retakeContext
    ? retakeContext.maxAttempts - retakeContext.totalAttempts
    : 0;
  const recommendations =
    submission.ai_analysis && Array.isArray(submission.ai_analysis.recommendations)
      ? submission.ai_analysis.recommendations.filter((item): item is string => typeof item === "string")
      : [];
  const needsOcrReview = submission.ocr_overall_status === "in_review";
  const waitingOcr =
    submission.ocr_overall_status === "pending" || submission.ocr_overall_status === "processing";
  const isPreliminary = submission.status === "preliminary";
  const hasAiScore = submission.llm_precheck_status === "completed" && submission.ai_score !== null;
  const feedbackReleased =
    typeof submission.feedback_released === "boolean"
      ? submission.feedback_released
      : submission.status === "approved";

  const handleRetake = () => {
    if (!retakeContext) return;
    setRetaking(true);
    navigate(courseId ? `/c/${courseId}/exam/${retakeContext.examId}` : "/dashboard");
  };

  return (
    <PageShell
      backLabel="К списку работ"
      onBack={() => navigate(courseId ? `/c/${courseId}/student` : "/dashboard")}
      title={submission.exam?.title ? `Результат: ${submission.exam.title}` : "Результат работы"}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge domain="workKind" value={submission.exam?.kind} />
          <span>
            Сдана {new Date(submission.submitted_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК
          </span>
          {submission.exam && submission.session && (
            <span>· попытка {submission.session.attempt_number} из {submission.exam.max_attempts}</span>
          )}
        </span>
      }
    >
      {/* Балл */}
      <Card className="mb-6 p-6 sm:p-8" aria-live="polite">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">
              {isPreliminary && hasAiScore ? "Предварительный балл" : displayScore === null ? "Результат проверки" : "Итоговый балл"}
            </p>
            <p className="font-display text-5xl font-semibold leading-none sm:text-6xl">
              {displayScore ?? "—"}
              <span className="ml-2 text-2xl text-muted-foreground">/ {submission.max_score}</span>
            </p>
            {isPreliminary && hasAiScore && (
              <p className="mt-2 text-sm text-muted-foreground">
                Предварительная оценка AI — преподаватель ещё проверит работу
              </p>
            )}
            {displayScore === null && (
              <p className="mt-2 text-sm text-muted-foreground">Оценка появится, когда обработка и проверка завершатся.</p>
            )}
          </div>
          <div className="text-right">
            <StatusBadge domain="submission" value={submission.status} />
            {displayScore !== null && (
              <p className="mt-2 font-display text-3xl font-semibold">{scorePercent.toFixed(0)}%</p>
            )}
          </div>
        </div>
        {displayScore !== null && <Progress value={scorePercent} className="mt-5 h-2" />}
      </Card>

      {/* Требуется проверка OCR */}
      {needsOcrReview && (
        <Card className="mb-6 border-accent/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ScanText className="h-7 w-7 text-accent" />
              <div>
                <h3 className="font-semibold">Проверьте распознавание</h3>
                <p className="text-sm text-muted-foreground">
                  Подтвердите, что система верно прочитала вашу работу — без этого проверка не начнётся.
                </p>
              </div>
            </div>
            <Link to={courseId ? `/c/${courseId}/exam/${sessionId}/ocr-review` : "/dashboard"}>
              <Button variant="accent">Перейти к проверке</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Обработка */}
      {(submission.status === "processing" || waitingOcr) && (
        <Card className="mb-6 border-info/40 p-5">
          <div className="flex items-center gap-3">
            <Clock className="h-7 w-7 animate-pulse text-info" />
            <div>
              <h3 className="font-semibold">Работа обрабатывается</h3>
              <p className="text-sm text-muted-foreground">
                {waitingOcr
                  ? "Распознаём загруженные страницы — страница обновится автоматически."
                  : "AI анализирует ваше решение. Обычно это занимает несколько минут."}
              </p>
            </div>
          </div>
        </Card>
      )}

      {!feedbackReleased && !needsOcrReview && !waitingOcr && submission.status !== "processing" && (
        <Card className="mb-6 border-accent/30 bg-accent/5 p-5">
          <h3 className="font-semibold">Подробный разбор пока закрыт</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPreliminary
              ? "Баллы и разбор откроются после последней попытки или завершения работы."
              : "Баллы, комментарии и разбалловка откроются после последней попытки или завершения работы."}
          </p>
        </Card>
      )}

      {(submission.ocr_overall_status === "failed" || submission.llm_precheck_status === "failed") && (
        <Card className="mb-6 border-destructive/30 p-5" role="alert">
          <h3 className="font-semibold">Часть автоматической проверки не завершилась</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Работа сохранена и остаётся доступной преподавателю. Итоговый результат появится после ручной проверки.
          </p>
        </Card>
      )}

      {submission.report_flag && (
        <Card className="mb-6 border-warning/40 p-5">
          <h3 className="mb-1 font-semibold">Ваши замечания к распознаванию отправлены</h3>
          <RichText className="ocr-rich-text text-sm text-muted-foreground">
            {submission.report_summary || "Преподаватель увидит отмеченные ошибки распознавания."}
          </RichText>
        </Card>
      )}

      {/* Комментарий преподавателя */}
      {feedbackReleased && submission.teacher_comments && (
        <Card className="mb-6 border-l-2 border-l-accent p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-accent" />
            Комментарий преподавателя
          </h3>
          <RichText className="text-sm">{submission.teacher_comments}</RichText>
        </Card>
      )}

      {/* Комментарий AI */}
      {feedbackReleased && submission.ai_comments && (
        <Card className="mb-6 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" />
            Разбор AI
          </h3>
          <RichText className="text-sm">{submission.ai_comments}</RichText>
        </Card>
      )}

      {/* Разбалловка */}
      {feedbackReleased && submission.scores && submission.scores.length > 0 && (
        <Card className="mb-6 p-5 sm:p-6">
          <h3 className="section-rule mb-5 text-xl font-semibold">Разбалловка по заданиям</h3>
          <div className="space-y-5">
            {submission.scores.map((score, index) => {
              const taskScore = score.final_score ?? score.ai_score;
              const taskPercent = score.max_score > 0 && taskScore !== null ? (taskScore / score.max_score) * 100 : 0;

              return (
                <div key={index} className="border-b pb-5 last:border-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-semibold">{score.criterion_name}</h4>
                      {score.criterion_description && (
                        <RichText className="mt-0.5 text-sm text-muted-foreground">
                          {score.criterion_description}
                        </RichText>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right">
                      <span className="font-display text-xl font-semibold">
                        {taskScore !== null ? taskScore.toFixed(1) : "—"} / {score.max_score}
                      </span>
                      {taskScore !== null && <p className="text-xs text-muted-foreground">{taskPercent.toFixed(0)}%</p>}
                    </div>
                  </div>

                  <Progress value={taskPercent} className="mb-3 h-1.5" />

                  {score.teacher_comment && (
                    <div className="rounded-md border-l-2 border-l-accent bg-accent/5 p-3">
                      <p className="mb-1 text-xs font-medium text-accent">Комментарий преподавателя</p>
                      <RichText className="text-sm">{score.teacher_comment}</RichText>
                    </div>
                  )}

                  {!score.teacher_comment && score.ai_comment && (
                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Комментарий AI</p>
                      <RichText className="text-sm">{score.ai_comment}</RichText>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Детальный анализ */}
      {feedbackReleased && submission.ai_analysis && (
        <Card className="mb-6 p-5 sm:p-6">
          <h3 className="section-rule mb-4 text-xl font-semibold">Детальный анализ</h3>
          <AiAnalysis data={submission.ai_analysis} />
        </Card>
      )}

      {/* Рекомендации */}
      {feedbackReleased && recommendations.length > 0 && (
        <Card className="mb-6 border-info/30 bg-info/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Lightbulb className="h-4 w-4 text-info" />
            Над чем поработать
          </h3>
          <ul className="list-inside list-disc space-y-1.5 text-sm">
            {recommendations.map((rec, i) => (
              <li key={i}><RichText inline>{rec}</RichText></li>
            ))}
          </ul>
        </Card>
      )}

      {/* Системные отметки */}
      {submission.is_flagged && submission.flag_reasons.length > 0 && (
        <Card className="mb-6 border-warning/40 p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Отметки системы
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {submission.flag_reasons.map((reason: string, i: number) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Повторная попытка */}
      {canRetake && retakeContext && (
        <Card className="mb-6 border-accent/40 bg-accent/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Можно попробовать ещё раз</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Осталось попыток: {remainingAttempts} из {retakeContext.maxAttempts}. Новая попытка может
                улучшить результат.
              </p>
            </div>
            <Button variant="accent" onClick={handleRetake} disabled={retaking} className="gap-2">
              <RefreshCw className={retaking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Начать новую попытку
            </Button>
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default ExamResult;
