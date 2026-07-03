import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  Plus,
  ScanText,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import OcrImageOverlay from "@/components/OcrImageOverlay";
import OcrMarkdownPanel from "@/components/OcrMarkdownPanel";
import { PageShell, PageLoader } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { ChunkListPanel, ChunkTypeChip } from "@/components/ChunkListPanel";
import { OcrIssueCard } from "@/components/OcrIssueCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHUNK_KINDS,
  CORRECTABLE_BLOCK_TYPES,
  chunkDisplayText,
  chunkKindForType,
  extractOcrBlocks,
  OcrChunkBlock,
} from "@/lib/ocr";
import { severityMeta } from "@/lib/statuses";
import { renderTaskText } from "@/lib/renderLatex";
import { getApiErrorMessage, JsonObject, OcrIssueInput, submissionsAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  correctedType: string;
  suggestedText: string;
  note: string;
  severity: OcrIssueSeverity;
}

const SAME_TYPE = "__same__";

const EMPTY_ISSUE_FORM: IssueDraftForm = {
  selectedChunkIndex: null,
  correctedType: SAME_TYPE,
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

const OcrReview = () => {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OcrPagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPage, setSavingPage] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, PageDraft>>({});
  const [savedPages, setSavedPages] = useState<Record<string, boolean>>({});
  const [reportSummary, setReportSummary] = useState("");
  const [issueForm, setIssueForm] = useState<IssueDraftForm>(EMPTY_ISSUE_FORM);
  const [showOcrText, setShowOcrText] = useState(false);

  const loadPages = useCallback(async () => {
    if (!sessionId) return;
    const response = await submissionsAPI.getOcrPages(sessionId, courseId);
    const payload = response.data as OcrPagesResponse;
    setData(payload);
    setReportSummary((prev) => prev || (payload.report_summary ?? ""));
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
    setSavedPages((prev) => {
      const next = { ...prev };
      for (const page of payload.pages) {
        if (page.page_status && next[page.image_id] === undefined) {
          next[page.image_id] = true;
        }
      }
      return next;
    });
  }, [courseId, sessionId]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadPages();
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось загрузить результат распознавания"));
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
        // продолжаем опрашивать
      });
    }, 2500);
    return () => clearInterval(intervalId);
  }, [data, loadPages]);

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const currentPage = pages[currentPageIndex];
  const currentImageId = currentPage?.image_id;
  const currentDraft = currentPage ? drafts[currentPage.image_id] ?? { issues: [] } : { issues: [] };
  const blocks = useMemo(() => extractOcrBlocks(currentPage?.chunks), [currentPage?.chunks]);
  const selectedBlock =
    issueForm.selectedChunkIndex !== null ? blocks[issueForm.selectedChunkIndex] ?? null : null;
  const selectedChunkText = selectedBlock ? chunkDisplayText(selectedBlock) : "";

  useEffect(() => {
    if (!currentImageId) return;
    setIssueForm({
      selectedChunkIndex: blocks.length > 0 ? 0 : null,
      correctedType: SAME_TYPE,
      suggestedText: "",
      note: "",
      severity: "major",
    });
    setShowOcrText(false);
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
  const progress = pages.length > 0 ? (reviewedPagesCount / pages.length) * 100 : 0;

  const markPageDirty = (imageId: string) => {
    setSavedPages((prev) => ({ ...prev, [imageId]: false }));
  };

  const approveCurrentPage = () => {
    if (!currentPage) return;
    setDrafts((prev) => ({
      ...prev,
      [currentPage.image_id]: {
        page_status: "approved",
        issues: prev[currentPage.image_id]?.issues ?? currentDraft.issues,
      },
    }));
    markPageDirty(currentPage.image_id);
  };

  const selectedTypeChanged =
    issueForm.correctedType !== SAME_TYPE &&
    selectedBlock !== null &&
    chunkKindForType(issueForm.correctedType) !== chunkKindForType(selectedBlock.block_type);

  const addIssue = () => {
    if (!currentPage) return;
    if (issueForm.selectedChunkIndex === null || !blocks[issueForm.selectedChunkIndex]) {
      toast.error("Сначала выберите блок на изображении или в списке");
      return;
    }

    const block = blocks[issueForm.selectedChunkIndex];
    if (!Array.isArray(block.bbox) && !Array.isArray(block.polygon)) {
      toast.error("У выбранного блока нет координат — выберите другой");
      return;
    }

    let note = issueForm.note.trim();
    if (!note && selectedTypeChanged) {
      const kindLabel = CHUNK_KINDS[chunkKindForType(issueForm.correctedType)].label.toLowerCase();
      note = `Неверно определён тип блока: это ${kindLabel}`;
    }
    if (!note) {
      toast.error("Опишите, что распознано неверно");
      return;
    }

    const anchor: JsonObject = {
      block_type:
        typeof block.block_type === "string" && block.block_type.trim().length > 0
          ? block.block_type
          : "text",
      page: typeof block.page === "number" ? block.page : currentPageIndex + 1,
    };
    if (selectedTypeChanged) {
      anchor.corrected_block_type = issueForm.correctedType;
    }
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
      original_text: chunkDisplayText(block),
      suggested_text: issueForm.suggestedText.trim() || undefined,
      note,
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
    markPageDirty(currentPage.image_id);

    setIssueForm((prev) => ({
      ...prev,
      correctedType: SAME_TYPE,
      suggestedText: "",
      note: "",
    }));
    toast.success("Замечание добавлено");
  };

  const removeIssue = (index: number) => {
    if (!currentPage) return;
    setDrafts((prev) => {
      const pageDraft = prev[currentPage.image_id] ?? { issues: [] };
      const issues = pageDraft.issues.filter((_, issueIndex) => issueIndex !== index);
      return {
        ...prev,
        [currentPage.image_id]: {
          page_status: issues.length > 0 ? "reported" : undefined,
          issues,
        },
      };
    });
    markPageDirty(currentPage.image_id);
  };

  const saveCurrentPage = async (): Promise<boolean> => {
    if (!currentPage || !sessionId) return false;
    const pageDraft = drafts[currentPage.image_id];
    if (!pageDraft?.page_status) {
      toast.error("Подтвердите страницу или добавьте замечание");
      return false;
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
      setSavedPages((prev) => ({ ...prev, [currentPage.image_id]: true }));
      toast.success(`Страница ${currentPageIndex + 1} сохранена`);
      return true;
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось сохранить страницу"));
      return false;
    } finally {
      setSavingPage(false);
    }
  };

  const saveAndNext = async () => {
    const ok = await saveCurrentPage();
    if (ok && currentPageIndex < pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const finalize = async () => {
    if (!sessionId || !data) return;
    if (reviewedPagesCount < pages.length) {
      toast.error("Сначала проверьте каждую страницу");
      return;
    }
    if (finalizeAction === "report" && !reportSummary.trim()) {
      toast.error("Кратко опишите замечания в поле итога");
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
      toast.success("Проверка распознавания завершена");
      navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось завершить проверку"));
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Проверка распознавания">
        <PageLoader label="Загружаем распознанный текст..." />
      </PageShell>
    );
  }

  if (!data) {
    return null;
  }

  if (data.ocr_status === "pending" || data.ocr_status === "processing") {
    return (
      <PageShell title="Проверка распознавания">
        <Card className="p-8">
          <div className="flex items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <div>
              <h2 className="text-lg font-semibold">Распознаём вашу работу</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Обычно это занимает меньше минуты. Страница обновится автоматически.
              </p>
            </div>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (data.ocr_status === "failed") {
    return (
      <PageShell title="Проверка распознавания">
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-8 w-8 flex-shrink-0 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold">Не удалось распознать работу</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Ничего страшного: работа уже передана преподавателю, он проверит её вручную.
              </p>
              <Button
                className="mt-4"
                onClick={() => navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard")}
              >
                Перейти к результату
              </Button>
            </div>
          </div>
        </Card>
      </PageShell>
    );
  }

  if (!currentPage) {
    return (
      <PageShell title="Проверка распознавания">
        <Card className="p-8 text-sm text-muted-foreground">Нет страниц для проверки.</Card>
      </PageShell>
    );
  }

  const currentPageSaved = currentImageId ? savedPages[currentImageId] : false;

  return (
    <PageShell
      width="wide"
      title="Проверка распознавания"
      subtitle="Убедитесь, что система верно прочитала вашу работу: подтвердите каждую страницу или отметьте ошибки — от этого зависит точность проверки."
    >
      {/* Навигация по страницам */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {pages.map((page, index) => {
          const draft = drafts[page.image_id];
          const status = draft?.page_status;
          return (
            <button
              key={page.image_id}
              type="button"
              onClick={() => setCurrentPageIndex(index)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                index === currentPageIndex
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "bg-card text-muted-foreground hover:bg-secondary"
              )}
            >
              Стр. {index + 1}
              {status === "approved" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
              {status === "reported" && <Flag className="h-3.5 w-3.5 text-warning" />}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Проверено {reviewedPagesCount} из {pages.length}
          </span>
          <Progress value={progress} className="h-1.5 w-28" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Изображение с разметкой */}
        <Card className="h-fit min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Страница {currentPageIndex + 1}</h2>
              <StatusBadge domain="page" value={currentDraft.page_status ?? "not_reviewed"} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowOcrText((prev) => !prev)}
            >
              <ScanText className="h-4 w-4" />
              {showOcrText ? "Показать фото" : "Весь текст"}
            </Button>
          </div>

          {showOcrText ? (
            <OcrMarkdownPanel
              markdown={currentPage.ocr_markdown}
              alwaysExpanded
              hideToggle
              previewLines={9999}
            />
          ) : (
            <OcrImageOverlay
              imageUrl={currentPage.image_view_url}
              blocks={blocks}
              selectedChunkIndex={issueForm.selectedChunkIndex}
              onSelectChunk={(index) =>
                setIssueForm((prev) => ({ ...prev, selectedChunkIndex: index }))
              }
              alt={`Страница ${currentPageIndex + 1}`}
              className="max-h-[75vh]"
            />
          )}
        </Card>

        {/* Правая колонка: блоки + замечание */}
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Распознанные блоки</h3>
            <ChunkListPanel
              blocks={blocks}
              selectedIndex={issueForm.selectedChunkIndex}
              onSelect={(index) => setIssueForm((prev) => ({ ...prev, selectedChunkIndex: index }))}
              listMaxHeight="max-h-[34vh]"
            />
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Ошибка в выбранном блоке?</h3>
            {selectedBlock ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-secondary/40 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <ChunkTypeChip blockType={selectedBlock.block_type} />
                    {issueForm.selectedChunkIndex !== null && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{issueForm.selectedChunkIndex + 1}
                      </span>
                    )}
                  </div>
                  <div className="ocr-rich-text max-h-28 overflow-auto text-xs leading-snug">
                    {selectedChunkText ? renderTaskText(selectedChunkText) : "(пустой блок)"}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Тип блока</Label>
                  <Select
                    value={issueForm.correctedType}
                    onValueChange={(value) =>
                      setIssueForm((prev) => ({ ...prev, correctedType: value }))
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SAME_TYPE}>Тип определён верно</SelectItem>
                      {CORRECTABLE_BLOCK_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          Это {CHUNK_KINDS[option.kind].label.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Как должно быть (необязательно)</Label>
                  <Input
                    className="mt-1"
                    placeholder="Правильный текст блока"
                    value={issueForm.suggestedText}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, suggestedText: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs">Что не так</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    placeholder={
                      selectedTypeChanged
                        ? "Можно оставить пустым — заполним автоматически"
                        : "Например: потерян индекс у формулы"
                    }
                    value={issueForm.note}
                    onChange={(event) =>
                      setIssueForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                  />
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Серьёзность</Label>
                    <Select
                      value={issueForm.severity}
                      onValueChange={(value) =>
                        setIssueForm((prev) => ({ ...prev, severity: value as OcrIssueSeverity }))
                      }
                    >
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["minor", "major", "critical"] as const).map((severity) => (
                          <SelectItem key={severity} value={severity}>
                            {severityMeta[severity].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={addIssue} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Добавить
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Выберите блок на изображении или в списке, чтобы сообщить об ошибке.
              </p>
            )}
          </Card>

          {currentDraft.issues.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">
                Замечания на странице · {currentDraft.issues.length}
              </h3>
              <div className="space-y-2">
                {currentDraft.issues.map((issue, idx) => (
                  <OcrIssueCard
                    key={`${idx}-${issue.note}`}
                    issue={{
                      anchor: issue.anchor as Record<string, unknown>,
                      original_text: issue.original_text,
                      suggested_text: issue.suggested_text,
                      note: issue.note,
                      severity: issue.severity ?? "major",
                    }}
                    onRemove={() => removeIssue(idx)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Итог с замечаниями */}
      {finalizeAction === "report" && (
        <Card className="mt-6 border-warning/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Flag className="h-4 w-4 text-warning" />
            <h3 className="font-semibold">Итог по замечаниям</h3>
            <span className="text-sm text-muted-foreground">· всего {totalIssuesCount}</span>
          </div>
          <Textarea
            value={reportSummary}
            onChange={(event) => setReportSummary(event.target.value)}
            placeholder="Кратко: где система ошиблась и на что преподавателю обратить внимание"
          />
        </Card>
      )}

      {/* Панель действий */}
      <div className="sticky bottom-4 mt-6 rounded-lg border bg-card/95 p-3 shadow-elegant backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentPageIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentPageIndex + 1} / {pages.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
              disabled={currentPageIndex === pages.length - 1}
            >
              Вперёд
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentDraft.page_status !== "approved" && currentDraft.issues.length === 0 && (
              <Button variant="outline" onClick={approveCurrentPage} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Страница распознана верно
              </Button>
            )}
            <Button
              onClick={saveAndNext}
              disabled={savingPage || !currentDraft.page_status || currentPageSaved === true}
              variant={currentPageSaved ? "secondary" : "default"}
              className="gap-1.5"
            >
              {savingPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentPageSaved ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : null}
              {currentPageSaved ? "Страница сохранена" : "Сохранить страницу"}
            </Button>
            <Button
              onClick={finalize}
              disabled={finalizing || reviewedPagesCount < pages.length}
              variant={finalizeAction === "report" ? "destructive" : "success"}
              className="gap-1.5"
              title={
                reviewedPagesCount < pages.length
                  ? "Сначала проверьте все страницы"
                  : undefined
              }
            >
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {finalizeAction === "report" ? "Отправить с замечаниями" : "Подтвердить и отправить"}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default OcrReview;
