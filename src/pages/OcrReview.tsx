import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
  ScanText,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import OcrImageOverlay from "@/components/OcrImageOverlay";
import OcrMarkdownPanel from "@/components/OcrMarkdownPanel";
import { PageShell, PageLoader } from "@/components/PageShell";
import { ChunkListPanel, ChunkTypeChip } from "@/components/ChunkListPanel";
import { OcrIssueCard } from "@/components/OcrIssueCard";
import { MathLiveEditor } from "@/components/MathLiveEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CHUNK_KINDS,
  CORRECTABLE_BLOCK_TYPES,
  chunkColor,
  chunkDisplayText,
  chunkKindForType,
  extractOcrBlocks,
  OcrChunkBlock,
} from "@/lib/ocr";
import { renderTaskText } from "@/lib/renderLatex";
import { getApiErrorMessage, JsonObject, OcrIssueInput, submissionsAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

interface OcrIssueResponse {
  id: string;
  review_id: string;
  image_id: string;
  anchor: Record<string, unknown>;
  original_text?: string | null;
  suggested_text?: string | null;
  note: string;
  severity: "minor" | "major" | "critical";
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

/* Правка одного блока: текст и/или тип. Хранится только если отличается от оригинала. */
interface ChunkEdit {
  text: string;
  originalText: string;
  correctedType: string | null;
}

const toDraftIssue = (issue: OcrIssueResponse): OcrIssueInput => ({
  anchor: (issue.anchor ?? {}) as JsonObject,
  original_text: issue.original_text,
  suggested_text: issue.suggested_text,
  note: issue.note,
  severity: issue.severity,
});

const blockHasGeometry = (block: OcrChunkBlock): boolean =>
  Array.isArray(block.bbox) || Array.isArray(block.polygon);

const OcrReview = () => {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OcrPagesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [edits, setEdits] = useState<Record<string, Record<number, ChunkEdit>>>({});
  const [extraIssues, setExtraIssues] = useState<Record<string, OcrIssueInput[]>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);
  const [showOcrText, setShowOcrText] = useState(false);

  const loadPages = useCallback(async () => {
    if (!sessionId) return;
    const response = await submissionsAPI.getOcrPages(sessionId, courseId);
    const payload = response.data as OcrPagesResponse;
    setData(payload);
    setExtraIssues((prev) => {
      const next = { ...prev };
      for (const page of payload.pages) {
        if (next[page.image_id] === undefined) {
          next[page.image_id] = page.issues.map(toDraftIssue);
        }
      }
      return next;
    });
    setVisited((prev) => {
      const next = { ...prev };
      for (const page of payload.pages) {
        if (page.page_status) {
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
  const blocks = useMemo(() => extractOcrBlocks(currentPage?.chunks), [currentPage?.chunks]);

  useEffect(() => {
    if (!currentImageId) return;
    setVisited((prev) => (prev[currentImageId] ? prev : { ...prev, [currentImageId]: true }));
    setSelectedChunkIndex(blocks.length > 0 ? 0 : null);
    setShowOcrText(false);
  }, [blocks.length, currentImageId]);

  const currentEdits = currentImageId ? edits[currentImageId] ?? {} : {};
  const editedIndexes = useMemo(() => new Set(Object.keys(currentEdits).map(Number)), [currentEdits]);

  const selectedBlock = selectedChunkIndex !== null ? blocks[selectedChunkIndex] ?? null : null;
  const selectedOriginalText = selectedBlock ? chunkDisplayText(selectedBlock) : "";
  const selectedEdit = selectedChunkIndex !== null ? currentEdits[selectedChunkIndex] : undefined;
  const editorText = selectedEdit?.text ?? selectedOriginalText;
  const effectiveKind = chunkKindForType(selectedEdit?.correctedType ?? selectedBlock?.block_type);
  const selectedEditable = selectedBlock ? blockHasGeometry(selectedBlock) : false;

  const applyEdit = (patch: Partial<Pick<ChunkEdit, "text" | "correctedType">>) => {
    if (!currentImageId || selectedChunkIndex === null || !selectedBlock) return;
    setEdits((prev) => {
      const pageEdits = { ...(prev[currentImageId] ?? {}) };
      const existing = pageEdits[selectedChunkIndex];
      const next: ChunkEdit = {
        text: patch.text ?? existing?.text ?? selectedOriginalText,
        originalText: existing?.originalText ?? selectedOriginalText,
        correctedType:
          patch.correctedType !== undefined ? patch.correctedType : existing?.correctedType ?? null,
      };
      const unchanged = next.text === next.originalText && next.correctedType === null;
      if (unchanged) {
        delete pageEdits[selectedChunkIndex];
      } else {
        pageEdits[selectedChunkIndex] = next;
      }
      return { ...prev, [currentImageId]: pageEdits };
    });
  };

  const handleTypeChip = (typeValue: string) => {
    if (!selectedBlock) return;
    const originalKind = chunkKindForType(selectedBlock.block_type);
    const clickedKind = chunkKindForType(typeValue);
    applyEdit({ correctedType: clickedKind === originalKind ? null : typeValue });
  };

  const revertSelected = () => {
    applyEdit({ text: selectedOriginalText, correctedType: null });
  };

  const removeExtraIssue = (imageId: string, index: number) => {
    setExtraIssues((prev) => ({
      ...prev,
      [imageId]: (prev[imageId] ?? []).filter((_, i) => i !== index),
    }));
  };

  const fixesByPage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const page of pages) {
      const editCount = Object.keys(edits[page.image_id] ?? {}).length;
      const extraCount = (extraIssues[page.image_id] ?? []).length;
      counts.set(page.image_id, editCount + extraCount);
    }
    return counts;
  }, [pages, edits, extraIssues]);

  const totalFixes = useMemo(
    () => Array.from(fixesByPage.values()).reduce((acc, n) => acc + n, 0),
    [fixesByPage]
  );

  const visitedCount = pages.filter((page) => visited[page.image_id]).length;
  const allVisited = pages.length > 0 && visitedCount === pages.length;

  const buildIssueFromEdit = (
    block: OcrChunkBlock,
    edit: ChunkEdit,
    pageIndex: number
  ): OcrIssueInput | null => {
    if (!blockHasGeometry(block)) return null;

    const changedText = edit.text.trim() !== edit.originalText.trim();
    const changedType = edit.correctedType !== null;
    const typeLabel = edit.correctedType
      ? CHUNK_KINDS[chunkKindForType(edit.correctedType)].label.toLowerCase()
      : "";

    const note =
      changedText && changedType
        ? `Исправлены текст и тип блока (это ${typeLabel})`
        : changedType
          ? `Неверно определён тип блока: это ${typeLabel}`
          : "Исправлен текст распознавания";

    const anchor: JsonObject = {
      block_type:
        typeof block.block_type === "string" && block.block_type.trim().length > 0
          ? block.block_type
          : "text",
      page: typeof block.page === "number" ? block.page : pageIndex + 1,
    };
    if (changedType && edit.correctedType) {
      anchor.corrected_block_type = edit.correctedType;
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

    return {
      anchor,
      original_text: edit.originalText,
      suggested_text: changedText ? edit.text.trim() : undefined,
      note,
      severity: changedType ? "major" : "minor",
    };
  };

  const finalize = async () => {
    if (!sessionId || !data || finalizing) return;
    if (!allVisited) {
      toast.error("Сначала просмотрите все страницы");
      return;
    }

    setFinalizing(true);
    try {
      const fixedPages: number[] = [];

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const page = pages[pageIndex];
        const pageBlocks = extractOcrBlocks(page.chunks);
        const pageEdits = edits[page.image_id] ?? {};
        const issues: OcrIssueInput[] = [...(extraIssues[page.image_id] ?? [])];

        for (const [indexKey, edit] of Object.entries(pageEdits)) {
          const block = pageBlocks[Number(indexKey)];
          if (!block) continue;
          const issue = buildIssueFromEdit(block, edit, pageIndex);
          if (issue) {
            issues.push(issue);
          }
        }

        if (issues.length > 0) {
          fixedPages.push(pageIndex + 1);
        }

        try {
          await submissionsAPI.reviewOcrPage(
            sessionId,
            page.image_id,
            {
              page_status: issues.length > 0 ? "reported" : "approved",
              issues,
            },
            courseId
          );
        } catch (error: unknown) {
          toast.error(
            getApiErrorMessage(error, `Не удалось сохранить страницу ${pageIndex + 1}`)
          );
          return;
        }
      }

      const anyFixes = fixedPages.length > 0;
      const summary = anyFixes
        ? `Исправления внесены прямо в распознанный текст. Всего правок: ${totalFixes}, страницы: ${fixedPages.join(", ")}.`
        : undefined;

      await submissionsAPI.finalizeOcrReview(
        sessionId,
        {
          action: anyFixes ? "report" : "submit",
          report_summary: summary,
        },
        courseId
      );
      toast.success(
        anyFixes ? "Правки отправлены, работа ушла на проверку" : "Распознавание подтверждено"
      );
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

  const currentExtra = extraIssues[currentImageId ?? ""] ?? [];

  return (
    <PageShell
      width="wide"
      title="Проверка распознавания"
      subtitle="Кликните блок и поправьте текст прямо в нём, если система прочитала неверно. Всё верно — просто отправьте."
    >
      {/* Навигация по страницам */}
      {pages.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {pages.map((page, index) => {
            const fixes = fixesByPage.get(page.image_id) ?? 0;
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
                {fixes > 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-warning">
                    <Pencil className="h-3 w-3" />
                    {fixes}
                  </span>
                ) : visited[page.image_id] ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Изображение с разметкой */}
        <Card className="h-fit min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Страница {currentPageIndex + 1}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setShowOcrText((prev) => !prev)}
            >
              {showOcrText ? <Eye className="h-4 w-4" /> : <ScanText className="h-4 w-4" />}
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
              selectedChunkIndex={selectedChunkIndex}
              onSelectChunk={setSelectedChunkIndex}
              alt={`Страница ${currentPageIndex + 1}`}
              className="max-h-[75vh]"
            />
          )}
        </Card>

        {/* Правая колонка: редактор выбранного блока + список */}
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            {selectedBlock ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Блок #{selectedChunkIndex !== null ? selectedChunkIndex + 1 : ""}
                  </h3>
                  {selectedEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
                      onClick={revertSelected}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Вернуть как было
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">распознано так</span>
                  )}
                </div>

                {/* Тип блока — один клик */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {CORRECTABLE_BLOCK_TYPES.map((option) => {
                    const active = effectiveKind === option.kind;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleTypeChip(option.value)}
                        disabled={!selectedEditable}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                          active ? "border-transparent" : "border-border bg-card hover:bg-secondary"
                        )}
                        style={
                          active
                            ? {
                                color: chunkColor(option.value),
                                backgroundColor: chunkColor(option.value, 0.12),
                              }
                            : undefined
                        }
                      >
                        {CHUNK_KINDS[option.kind].label}
                      </button>
                    );
                  })}
                  {effectiveKind === "other" && <ChunkTypeChip blockType={selectedBlock.block_type} />}
                </div>

                {selectedEditable ? (
                  <>
                    <MathLiveEditor
                      key={`${currentImageId}-${selectedChunkIndex}`}
                      value={editorText}
                      onChange={(text) => applyEdit({ text })}
                      placeholder="Распознанный текст блока"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Формулы отображаются как есть — нажмите на формулу, чтобы исправить её код.
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    У этого блока нет координат на изображении — исправить его нельзя. Если в нём
                    ошибка, преподаватель увидит её при проверке.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Кликните блок на изображении или выберите его в списке ниже.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">Все блоки страницы</h3>
            <ChunkListPanel
              blocks={blocks}
              selectedIndex={selectedChunkIndex}
              onSelect={setSelectedChunkIndex}
              listMaxHeight="max-h-[38vh]"
              editedIndexes={editedIndexes}
              editedTexts={Object.fromEntries(
                Object.entries(currentEdits).map(([index, edit]) => [index, edit.text])
              )}
              hideEmpty
            />
          </Card>

          {currentExtra.length > 0 && currentImageId && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold">
                Ранее добавленные правки · {currentExtra.length}
              </h3>
              <div className="space-y-2">
                {currentExtra.map((issue, idx) => (
                  <OcrIssueCard
                    key={`${idx}-${issue.note}`}
                    issue={{
                      anchor: issue.anchor as Record<string, unknown>,
                      original_text: issue.original_text,
                      suggested_text: issue.suggested_text,
                      note: issue.note,
                      severity: issue.severity ?? "major",
                    }}
                    onRemove={() => removeExtraIssue(currentImageId, idx)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

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

          <div className="flex flex-wrap items-center gap-3">
            {pages.length > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Просмотрено {visitedCount} из {pages.length}
                </span>
                <Progress value={(visitedCount / pages.length) * 100} className="h-1.5 w-24" />
              </div>
            )}
            {totalFixes > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-warning">
                <Pencil className="h-3.5 w-3.5" />
                {totalFixes}
              </span>
            )}
            <Button
              onClick={finalize}
              disabled={finalizing || !allVisited}
              variant={totalFixes > 0 ? "accent" : "success"}
              className="gap-1.5"
              title={!allVisited ? "Сначала просмотрите все страницы" : undefined}
            >
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {totalFixes > 0 ? `Отправить (${totalFixes} испр.)` : "Всё верно — отправить"}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default OcrReview;
