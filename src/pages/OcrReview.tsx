import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  ScanText,
} from "lucide-react";

import OcrImageOverlay from "@/components/OcrImageOverlay";
import OcrMarkdownPanel from "@/components/OcrMarkdownPanel";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { anchorSummary, extractOcrBlocks, OcrChunkBlock } from "@/lib/ocr";
import { getApiErrorMessage, JsonObject, OcrIssueInput, submissionsAPI } from "@/lib/api";
import { toast } from "sonner";

type OcrIssueSeverity = "minor" | "major" | "critical";

interface OcrIssueResponse {
  id: string;
  review_id: string;
  image_id: string;
  anchor: Record<string, unknown>;
  original_text?: string | null;
  suggested_text?: string | null;
  note: string;
  severity: OcrIssueSeverity;
  created_at: string;
}

interface OcrPageData {
  image_id: string;
  image_view_url?: string | null;
  ocr_status: "pending" | "processing" | "ready" | "failed";
  ocr_markdown?: string | null;
  chunks?: unknown;
  page_status?: "approved" | "reported" | null;
  issues: OcrIssueResponse[];
}

interface OcrPagesResponse {
  submission_id: string;
  ocr_status:
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
  pages: OcrPageData[];
}

interface PageDraft {
  page_status?: "approved" | "reported";
  issues: OcrIssueInput[];
}

interface IssueDraftForm {
  selectedChunkIndex: number | null;
  suggestedText: string;
  note: string;
  severity: OcrIssueSeverity;
}

const EMPTY_ISSUE_FORM: IssueDraftForm = {
  selectedChunkIndex: null,
  suggestedText: "",
  note: "",
  severity: "major",
};

const toDraftIssue = (issue: OcrIssueResponse): OcrIssueInput => ({
  anchor: (issue.anchor ?? {}) as JsonObject,
  original_text: issue.original_text,
  suggested_text: issue.suggested_text,
  note: issue.note,
  severity: issue.severity,
});

const chunkTitle = (block: OcrChunkBlock, index: number) => {
  const kind = typeof block.block_type === "string" && block.block_type.trim() ? block.block_type : "chunk";
  const page = typeof block.page === "number" ? ` • page ${block.page}` : "";
  return `${kind} #${index + 1}${page}`;
};

const chunkPreview = (block: OcrChunkBlock) => {
  if (typeof block.text !== "string") {
    return "(пустой OCR блок)";
  }
  const normalized = block.text.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
};

const OcrReview = () => {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OcrPagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPage, setSavingPage] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, PageDraft>>({});
  const [reportSummary, setReportSummary] = useState("");
  const [issueForm, setIssueForm] = useState<IssueDraftForm>(EMPTY_ISSUE_FORM);

  const loadPages = useCallback(async () => {
    if (!sessionId) return;
    const response = await submissionsAPI.getOcrPages(sessionId, courseId);
    const payload = response.data as OcrPagesResponse;
    setData(payload);
    setReportSummary(payload.report_summary ?? "");
    setDrafts((prev) => {
      const next = { ...prev };
      for (const page of payload.pages) {
        next[page.image_id] = {
          page_status: next[page.image_id]?.page_status ?? page.page_status ?? undefined,
          issues: next[page.image_id]?.issues ?? page.issues.map(toDraftIssue),
        };
      }
      return next;
    });
  }, [courseId, sessionId]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadPages();
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось загрузить OCR-страницы"));
        navigate(courseId ? `/c/${courseId}/student` : "/dashboard");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [courseId, loadPages, navigate]);

  useEffect(() => {
    if (!data) return;
    if (data.ocr_status !== "pending" && data.ocr_status !== "processing") return;
    const intervalId = setInterval(() => {
      loadPages().catch(() => {
        // keep polling
      });
    }, 2500);
    return () => clearInterval(intervalId);
  }, [data, loadPages]);

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const currentPage = pages[currentPageIndex];
  const currentImageId = currentPage?.image_id;
  const currentDraft = currentPage ? drafts[currentPage.image_id] ?? { issues: [] } : { issues: [] };
  const blocks = useMemo(() => extractOcrBlocks(currentPage?.chunks), [currentPage?.chunks]);

  useEffect(() => {
    if (!currentImageId) return;
    setIssueForm((prev) => ({
      ...prev,
      selectedChunkIndex: blocks.length > 0 ? 0 : null,
      suggestedText: "",
      note: "",
      severity: "major",
    }));
  }, [blocks.length, currentImageId]);

  const reviewedPagesCount = useMemo(
    () =>
      pages.filter((page) => {
        const draft = drafts[page.image_id];
        return draft?.page_status === "approved" || draft?.page_status === "reported";
      }).length,
    [drafts, pages]
  );

  const totalIssuesCount = useMemo(
    () => pages.reduce((acc, page) => acc + (drafts[page.image_id]?.issues.length ?? 0), 0),
    [drafts, pages]
  );

  const finalizeAction: "submit" | "report" = totalIssuesCount > 0 ? "report" : "submit";
  const finalizeLabel = finalizeAction === "report" ? "Репорт" : "Сдать";
  const progress = pages.length > 0 ? (reviewedPagesCount / pages.length) * 100 : 0;

  const setCurrentPageStatus = (pageStatus: "approved" | "reported") => {
    if (!currentPage) return;
    setDrafts((prev) => ({
      ...prev,
      [currentPage.image_id]: {
        page_status: pageStatus,
        issues: prev[currentPage.image_id]?.issues ?? currentDraft.issues,
      },
    }));
  };

  const addIssue = () => {
    if (!currentPage) return;
    if (issueForm.selectedChunkIndex === null || !blocks[issueForm.selectedChunkIndex]) {
      toast.error("Выберите OCR chunk");
      return;
    }
    if (!issueForm.note.trim()) {
      toast.error("Добавьте заметку к OCR-ошибке");
      return;
    }

    const block = blocks[issueForm.selectedChunkIndex];
    if (!Array.isArray(block.bbox) && !Array.isArray(block.polygon)) {
      toast.error("У выбранного OCR-блока нет bbox/polygon геометрии");
      return;
    }

    const anchor: JsonObject = {
      block_type:
        typeof block.block_type === "string" && block.block_type.trim().length > 0
          ? block.block_type
          : "text",
      page: typeof block.page === "number" ? block.page : currentPageIndex + 1,
    };
    if (typeof block.id === "string" && block.id.trim().length > 0) {
      anchor.chunk_id = block.id;
    }
    if (Array.isArray(block.bbox)) {
      anchor.bbox = block.bbox as unknown as JsonObject[keyof JsonObject];
    }
    if (Array.isArray(block.polygon)) {
      anchor.polygon = block.polygon as unknown as JsonObject[keyof JsonObject];
    }

    const issue: OcrIssueInput = {
      anchor,
      original_text: block.text ?? "",
      suggested_text: issueForm.suggestedText.trim() || undefined,
      note: issueForm.note.trim(),
      severity: issueForm.severity,
    };

    setDrafts((prev) => {
      const pageDraft = prev[currentPage.image_id] ?? { issues: [] };
      return {
        ...prev,
        [currentPage.image_id]: {
          page_status: "reported",
          issues: [...pageDraft.issues, issue],
        },
      };
    });

    setIssueForm((prev) => ({ ...prev, suggestedText: "", note: "" }));
  };

  const removeIssue = (index: number) => {
    if (!currentPage) return;
    setDrafts((prev) => {
      const pageDraft = prev[currentPage.image_id] ?? { issues: [] };
      const issues = pageDraft.issues.filter((_, issueIndex) => issueIndex !== index);
      return {
        ...prev,
        [currentPage.image_id]: {
          page_status: issues.length > 0 ? "reported" : pageDraft.page_status,
          issues,
        },
      };
    });
  };

  const saveCurrentPage = async () => {
    if (!currentPage || !sessionId) return;
    const pageDraft = drafts[currentPage.image_id];
    if (!pageDraft?.page_status) {
      toast.error("Выберите статус страницы: approved или reported");
      return;
    }
    if (pageDraft.page_status === "reported" && pageDraft.issues.length === 0) {
      toast.error("Для reported-страницы нужен хотя бы один OCR issue");
      return;
    }
    if (pageDraft.page_status === "approved" && pageDraft.issues.length > 0) {
      toast.error("У approved-страницы не должно быть OCR issues");
      return;
    }

    setSavingPage(true);
    try {
      await submissionsAPI.reviewOcrPage(
        sessionId,
        currentPage.image_id,
        {
          page_status: pageDraft.page_status,
          issues: pageDraft.issues,
        },
        courseId
      );
      toast.success("Страница OCR сохранена");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось сохранить OCR review страницы"));
    } finally {
      setSavingPage(false);
    }
  };

  const finalize = async () => {
    if (!sessionId || !data) return;
    if (reviewedPagesCount < pages.length) {
      toast.error("Нужно подтвердить или зарепортить каждую страницу");
      return;
    }
    if (finalizeAction === "report" && !reportSummary.trim()) {
      toast.error("Для REPORT добавьте общее summary");
      return;
    }

    setFinalizing(true);
    try {
      await submissionsAPI.finalizeOcrReview(
        sessionId,
        {
          action: finalizeAction,
          report_summary: finalizeAction === "report" ? reportSummary.trim() : undefined,
        },
        courseId
      );
      toast.success("OCR review завершен");
      navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось завершить OCR review"));
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <p>Загрузка OCR...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.ocr_status === "pending" || data.ocr_status === "processing") {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <Card className="p-8">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <div>
                <h2 className="text-xl font-semibold">OCR обрабатывается</h2>
                <p className="text-sm text-muted-foreground">
                  Ждем DataLab Marker result. Страница обновляется автоматически.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (data.ocr_status === "failed") {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12 space-y-4">
          <Card className="p-8">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div>
                <h2 className="text-xl font-semibold">OCR завершился ошибкой</h2>
                <p className="text-sm text-muted-foreground">
                  Работа будет передана преподавателю для ручной проверки.
                </p>
              </div>
            </div>
          </Card>
          <Button onClick={() => navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard")}>
            К результату
          </Button>
        </div>
      </div>
    );
  }

  if (!currentPage) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <p>Нет OCR-страниц для проверки.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-12 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">OCR Validation</h1>
            <p className="text-sm text-muted-foreground">
              Подтвердите OCR постранично. Это обязательный шаг перед финальной отправкой.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Страниц: {pages.length}</Badge>
            <Badge variant={totalIssuesCount > 0 ? "destructive" : "secondary"}>
              {totalIssuesCount > 0 ? `Issues: ${totalIssuesCount}` : "Issues: 0"}
            </Badge>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Прогресс review</span>
            <span>
              {reviewedPagesCount} / {pages.length}
            </span>
          </div>
          <Progress value={progress} />
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Оригинал страницы #{currentPageIndex + 1}</h2>
              <Badge variant="outline">{currentPage.ocr_status}</Badge>
            </div>
            <OcrImageOverlay
              imageUrl={currentPage.image_view_url}
              blocks={blocks}
              selectedChunkIndex={issueForm.selectedChunkIndex}
              alt={`OCR page ${currentPageIndex + 1}`}
              className="max-h-[72vh]"
            />
            <p className="text-xs text-muted-foreground">
              Выделенный chunk подсвечен на изображении, чтобы было понятно, какой фрагмент вы исправляете.
            </p>
          </Card>

          <Card className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ScanText className="h-4 w-4" />
                <h2 className="font-semibold">OCR Markdown</h2>
              </div>
              <OcrMarkdownPanel markdown={currentPage.ocr_markdown} previewLines={12} />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Статус страницы</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={currentDraft.page_status === "approved" ? "default" : "outline"}
                  onClick={() => setCurrentPageStatus("approved")}
                >
                  Approved
                </Button>
                <Button
                  type="button"
                  variant={currentDraft.page_status === "reported" ? "default" : "outline"}
                  onClick={() => setCurrentPageStatus("reported")}
                >
                  Reported
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">OCR chunks (anchor geometry)</h3>
              <div className="max-h-52 rounded border p-2 overflow-y-auto">
                <div className="space-y-2">
                  {blocks.map((block, idx) => (
                    <button
                      key={`${block.id ?? "chunk"}-${idx}`}
                      type="button"
                      className={`w-full rounded border p-2 text-left text-xs ${
                        issueForm.selectedChunkIndex === idx
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => setIssueForm((prev) => ({ ...prev, selectedChunkIndex: idx }))}
                    >
                      <div className="font-medium">{chunkTitle(block, idx)}</div>
                      <div className="text-muted-foreground line-clamp-2">{chunkPreview(block)}</div>
                    </button>
                  ))}
                  {blocks.length === 0 && (
                    <p className="text-xs text-muted-foreground">Нет chunk-блоков для выбора.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded border p-3">
              <h3 className="text-sm font-semibold">Добавить OCR issue</h3>
              <Input
                placeholder="Правильный текст (optional)"
                value={issueForm.suggestedText}
                onChange={(event) =>
                  setIssueForm((prev) => ({ ...prev, suggestedText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Описание OCR-ошибки"
                value={issueForm.note}
                onChange={(event) => setIssueForm((prev) => ({ ...prev, note: event.target.value }))}
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs">Severity</Label>
                <select
                  value={issueForm.severity}
                  onChange={(event) =>
                    setIssueForm((prev) => ({ ...prev, severity: event.target.value as OcrIssueSeverity }))
                  }
                  className="h-9 rounded border px-2 text-sm bg-background"
                >
                  <option value="minor">minor</option>
                  <option value="major">major</option>
                  <option value="critical">critical</option>
                </select>
                <Button type="button" onClick={addIssue}>
                  Добавить issue
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Issues страницы</h3>
              <div className="space-y-2">
                {currentDraft.issues.map((issue, idx) => (
                  <div key={`${idx}-${issue.note}`} className="rounded border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{issue.severity ?? "major"}</Badge>
                      <span className="text-muted-foreground">{anchorSummary(issue.anchor as Record<string, unknown>)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIssue(idx)}
                        className="h-6 px-2"
                      >
                        удалить
                      </Button>
                    </div>
                    <p className="mt-1 text-muted-foreground">{issue.note}</p>
                    {issue.suggested_text && (
                      <p className="mt-1">
                        suggested: <span className="font-medium">{issue.suggested_text}</span>
                      </p>
                    )}
                  </div>
                ))}
                {currentDraft.issues.length === 0 && (
                  <p className="text-xs text-muted-foreground">Issue-заметок пока нет.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Предыдущая
              </Button>
              <Button onClick={saveCurrentPage} disabled={savingPage}>
                {savingPage ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                Сохранить страницу
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
              >
                Следующая
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        </div>

        {finalizeAction === "report" && (
          <Card className="p-4 space-y-2 border-destructive/30">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" />
              <h3 className="font-semibold">REPORT summary</h3>
            </div>
            <Textarea
              value={reportSummary}
              onChange={(event) => setReportSummary(event.target.value)}
              placeholder="Кратко опишите, где OCR ошибся и на что обратить внимание преподавателю"
            />
          </Card>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={finalize}
            disabled={finalizing || reviewedPagesCount < pages.length}
            className={finalizeAction === "report" ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {finalizeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OcrReview;
