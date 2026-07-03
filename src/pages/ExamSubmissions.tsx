import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FileText, Flag } from "lucide-react";
import { toast } from "sonner";

import { PageShell, PageLoader } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { examsAPI, getApiErrorMessage } from "@/lib/api";
import type { WorkKind } from "@/lib/api";
import type { BadgeTone } from "@/lib/statuses";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  student_username: string;
  student_name: string;
  submitted_at: string;
  status: string;
  ocr_overall_status?:
    | "not_required"
    | "pending"
    | "processing"
    | "in_review"
    | "validated"
    | "reported"
    | "failed";
  llm_precheck_status?: "skipped" | "queued" | "processing" | "completed" | "failed";
  report_flag?: boolean;
  ai_score: number | null;
  final_score: number | null;
  max_score: number;
}

interface ExamDetails {
  id: string;
  title: string;
  kind?: WorkKind;
}

const pipelineStage = (submission: Submission): { label: string; tone: BadgeTone } => {
  switch (submission.status) {
    case "approved":
      return { label: "Проверена", tone: "success" };
    case "preliminary":
      return { label: "Ждёт вашей проверки", tone: "warning" };
    case "processing":
      return submission.llm_precheck_status === "queued"
        ? { label: "AI в очереди", tone: "muted" }
        : { label: "AI проверяет", tone: "info" };
    case "uploaded":
      if (submission.ocr_overall_status === "in_review") {
        return { label: "Студент проверяет OCR", tone: "info" };
      }
      return { label: "Распознаётся", tone: "muted" };
    case "flagged":
      return { label: "Требует внимания", tone: "warning" };
    case "rejected":
      return { label: "Отклонена", tone: "destructive" };
    default:
      return { label: submission.status, tone: "muted" };
  }
};

const ExamSubmissions = () => {
  const { courseId, examId } = useParams<{ courseId: string; examId: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<ExamDetails | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const examResponse = await examsAPI.get(examId!, courseId);
        setExam(examResponse.data);

        const submissionsResponse = await examsAPI.listSubmissions(
          examId!,
          courseId,
          filter ? { status: filter } : undefined
        );
        setSubmissions(submissionsResponse.data.items);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось загрузить решения"));
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      loadData();
    }
  }, [courseId, examId, filter]);

  if (loading) {
    return (
      <PageShell title="Решения студентов">
        <PageLoader label="Загружаем решения..." />
      </PageShell>
    );
  }

  if (!exam) {
    return (
      <PageShell title="Решения студентов">
        <EmptyState
          icon={FileText}
          title="Работа не найдена"
          action={
            <Link to={courseId ? `/c/${courseId}/teacher` : "/dashboard"}>
              <Button variant="outline">К списку работ</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  const pendingCount = submissions.filter((s) => s.status === "preliminary").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;

  return (
    <PageShell
      width="wide"
      backLabel="К списку работ"
      onBack={() => navigate(courseId ? `/c/${courseId}/teacher` : "/dashboard")}
      title="Решения студентов"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          {exam.title}
          <StatusBadge domain="workKind" value={exam.kind} />
        </span>
      }
    >
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="font-display text-3xl font-semibold">{submissions.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">Сдано решений</p>
        </Card>
        <Card className={cn("p-5", pendingCount > 0 && "border-warning/50")}>
          <p className={cn("font-display text-3xl font-semibold", pendingCount > 0 && "text-warning")}>
            {pendingCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Ждут проверки</p>
        </Card>
        <Card className="p-5">
          <p className="font-display text-3xl font-semibold">{approvedCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Проверено</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h2 className="font-semibold">Работы студентов</h2>
          <div className="inline-flex rounded-md border bg-muted/60 p-0.5">
            {([
              [null, "Все"],
              ["preliminary", "Ждут проверки"],
              ["approved", "Проверенные"],
            ] as const).map(([value, label]) => (
              <Button
                key={label}
                size="sm"
                variant="ghost"
                className={cn("h-8", filter === value && "bg-card shadow-soft")}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filter ? "По этому фильтру решений нет" : "Решения пока не сданы"}
            description={filter ? undefined : "Как только студенты сдадут работы, они появятся здесь."}
            className="m-4"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Студент</th>
                  <th className="px-4 py-2.5 font-medium">Сдана</th>
                  <th className="px-4 py-2.5 font-medium">Этап</th>
                  <th className="px-4 py-2.5 font-medium">Отметки</th>
                  <th className="px-4 py-2.5 text-right font-medium">Балл</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const stage = pipelineStage(submission);
                  const canOpen = ["preliminary", "approved", "flagged", "rejected"].includes(
                    submission.status
                  );
                  return (
                    <tr key={submission.id} className="border-b last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{submission.student_name}</p>
                        <p className="text-xs text-muted-foreground">@{submission.student_username}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(submission.submitted_at).toLocaleString("ru-RU", {
                          timeZone: "Europe/Moscow",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={stage.tone}>{stage.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {submission.report_flag && (
                            <Badge variant="warning" className="gap-1">
                              <Flag className="h-3 w-3" />
                              Замечания к OCR
                            </Badge>
                          )}
                          {submission.ocr_overall_status === "failed" && (
                            <Badge variant="destructive">Ошибка OCR</Badge>
                          )}
                          {submission.llm_precheck_status === "skipped" && (
                            <Badge variant="muted">Без AI</Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {submission.final_score !== null ? (
                          <span className="font-mono font-semibold">
                            {submission.final_score.toFixed(1)} / {submission.max_score}
                          </span>
                        ) : submission.ai_score !== null ? (
                          <span
                            className="font-mono text-accent"
                            title="Предварительная оценка AI"
                          >
                            {submission.ai_score.toFixed(1)} / {submission.max_score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canOpen ? (
                          <Link to={courseId ? `/c/${courseId}/submission/${submission.id}` : "/dashboard"}>
                            <Button
                              size="sm"
                              variant={submission.status === "preliminary" ? "accent" : "outline"}
                            >
                              {submission.status === "preliminary" ? "Проверить" : "Открыть"}
                            </Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled variant="outline">
                            В обработке
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
};

export default ExamSubmissions;
