import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Edit3,
  FileImage,
  Flag,
  Images,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { PageShell, PageLoader } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ChunkListPanel } from "@/components/ChunkListPanel";
import { OcrIssueCard } from "@/components/OcrIssueCard";
import OcrImageOverlay from "@/components/OcrImageOverlay";
import OcrMarkdownPanel from "@/components/OcrMarkdownPanel";
import ImageLightbox from "@/components/ImageLightbox";
import AiAnalysis from "@/components/AiAnalysis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage, submissionsAPI } from "@/lib/api";
import { renderLatex, renderTaskText } from "@/lib/renderLatex";
import { chunkDisplayText, extractOcrBlocks } from "@/lib/ocr";
import { cn } from "@/lib/utils";

interface SubmissionImage {
  id: string;
  order_index?: number;
  ocr_status?: string;
  ocr_text?: string | null;
  ocr_markdown?: string | null;
  ocr_chunks?: unknown;
  quality_score?: number | null;
}

interface SubmissionScore {
  criterion_name: string;
  max_score: number;
  ai_score: number | null;
  ai_comment?: string | null;
}

interface SubmissionTaskType {
  id: string;
  title: string;
  description?: string | null;
  order_index?: number;
  max_score?: number;
  formulas?: string[];
}

interface SubmissionTaskVariant {
  id?: string;
  content?: string | null;
}

interface SubmissionTask {
  task_type: SubmissionTaskType;
  variant: SubmissionTaskVariant;
}

interface SubmissionIssue {
  id: string;
  image_id: string;
  anchor: Record<string, unknown>;
  original_text?: string | null;
  suggested_text?: string | null;
  note: string;
  severity: "minor" | "major" | "critical";
  created_at: string;
}

interface SubmissionOcrPage {
  image_id: string;
  order_index?: number;
  ocr_status?: string;
  ocr_markdown?: string | null;
  chunks?: unknown;
  page_status?: "approved" | "reported" | null;
  issues?: SubmissionIssue[];
}

interface SubmissionReviewData {
  student_name?: string;
  student_id: string;
  student_username?: string;
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
  report_summary?: string | null;
  ocr_error?: string | null;
  llm_error?: string | null;
  max_score: number;
  final_score: number | null;
  ai_score: number | null;
  teacher_comments?: string | null;
  images: SubmissionImage[];
  scores: SubmissionScore[];
  ai_analysis?: Record<string, unknown> & {
    full_transcription_md?: string;
    recommendations?: string[];
  };
  ai_comments?: string | null;
  is_flagged: boolean;
  flag_reasons: string[];
  ocr_pages?: SubmissionOcrPage[];
  report_issues?: SubmissionIssue[];
  tasks?: SubmissionTask[];
  exam?: {
    id: string;
    title: string;
    kind?: "control" | "homework";
  };
}

type PageViewMode = "markup" | "photo" | "text";

const normalizeTaskText = (value: string) => value.replace(/\s+/g, " ").trim();

const SubmissionReview = () => {
  const { courseId, submissionId } = useParams<{ courseId: string; submissionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageAngles, setImageAngles] = useState<Record<string, number>>({});
  const [imageScales, setImageScales] = useState<Record<string, number>>({});
  const [selectedChunkByImage, setSelectedChunkByImage] = useState<Record<string, number | null>>({});
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<PageViewMode>("markup");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [teacherComments, setTeacherComments] = useState("");

  useEffect(() => {
    const loadSubmission = async () => {
      try {
        const response = await submissionsAPI.get(submissionId!, courseId);
        const submissionData = response.data as SubmissionReviewData;
        setSubmission(submissionData);
        setOverrideScore(submissionData.final_score || submissionData.ai_score || 0);
        setTeacherComments(submissionData.teacher_comments || "");

        if (submissionData.images && submissionData.images.length > 0) {
          const urls: Record<string, string> = {};
          const failedImageIds: string[] = [];
          for (const image of submissionData.images) {
            try {
              const urlResponse = await submissionsAPI.getImageViewUrl(image.id, courseId);
              if (urlResponse.data.view_url) {
                urls[image.id] = urlResponse.data.view_url;
              } else if (urlResponse.data.file_path) {
                urls[image.id] = `/api/uploads/${urlResponse.data.file_path}`;
              } else {
                failedImageIds.push(image.id);
              }
            } catch {
              failedImageIds.push(image.id);
            }
          }
          setImageUrls(urls);
          if (failedImageIds.length > 0) {
            toast.error(`Не удалось получить изображения: ${failedImageIds.length} шт.`);
          }
        }
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось загрузить работу"));
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) {
      loadSubmission();
    }
  }, [courseId, submissionId, navigate]);

  const orderedImages = useMemo(
    () =>
      (submission?.images ?? [])
        .slice()
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [submission?.images]
  );

  const ocrPageByImageId = useMemo(() => {
    const map = new Map<string, SubmissionOcrPage>();
    for (const page of submission?.ocr_pages ?? []) {
      map.set(page.image_id, page);
    }
    return map;
  }, [submission?.ocr_pages]);

  const issuesByImageId = useMemo(() => {
    const map = new Map<string, SubmissionIssue[]>();
    const source =
      submission?.ocr_pages?.flatMap((page) => page.issues ?? []) ??
      submission?.report_issues ??
      [];
    for (const issue of source) {
      const list = map.get(issue.image_id) ?? [];
      list.push(issue);
      map.set(issue.image_id, list);
    }
    return map;
  }, [submission?.ocr_pages, submission?.report_issues]);

  const totalIssues = useMemo(
    () => Array.from(issuesByImageId.values()).reduce((acc, list) => acc + list.length, 0),
    [issuesByImageId]
  );

  const currentImage = orderedImages[activePageIndex] ?? null;
  const currentOcrPage = currentImage ? ocrPageByImageId.get(currentImage.id) ?? null : null;
  const currentBlocks = useMemo(
    () => extractOcrBlocks(currentOcrPage?.chunks),
    [currentOcrPage?.chunks]
  );
  const hasMarkup = currentBlocks.length > 0;
  const hasOcrText = Boolean(currentOcrPage?.ocr_markdown);
  const effectiveViewMode: PageViewMode =
    viewMode === "markup" && !hasMarkup ? (hasOcrText ? "text" : "photo") :
    viewMode === "text" && !hasOcrText ? "photo" :
    viewMode;

  const selectedChunkIndex = currentImage
    ? selectedChunkByImage[currentImage.id] ?? (hasMarkup ? 0 : null)
    : null;
  const selectedBlock =
    selectedChunkIndex !== null ? currentBlocks[selectedChunkIndex] ?? null : null;
  const selectedChunkText = selectedBlock ? chunkDisplayText(selectedBlock) : "";
  const currentIssues = currentImage ? issuesByImageId.get(currentImage.id) ?? [] : [];

  const lightboxImages = useMemo(
    () =>
      orderedImages
        .map((image) => ({ id: image.id, url: imageUrls[image.id] }))
        .filter((item): item is { id: string; url: string } => Boolean(item.url)),
    [orderedImages, imageUrls]
  );

  const rotateImage = (id: string, delta: number) => {
    setImageAngles((prev) => ({ ...prev, [id]: ((prev[id] || 0) + delta) % 360 }));
  };

  const zoomImage = (id: string, delta: number) => {
    setImageScales((prev) => {
      const next = Math.min(3, Math.max(0.5, (prev[id] || 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const openLightbox = (imageId: string) => {
    const index = lightboxImages.findIndex((item) => item.id === imageId);
    setLightboxIndex(index >= 0 ? index : 0);
    setLightboxOpen(true);
  };

  const handleApprove = async () => {
    try {
      await submissionsAPI.approve(submissionId!, { teacher_comments: teacherComments }, courseId);
      toast.success("Работа проверена, оценка отправлена студенту");
      navigate(-1);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось утвердить работу"));
    }
  };

  const handleOverride = async () => {
    try {
      await submissionsAPI.overrideScore(
        submissionId!,
        {
          final_score: overrideScore,
          teacher_comments: teacherComments || "",
        },
        courseId
      );
      toast.success("Оценка сохранена");
      setEditing(false);
      const response = await submissionsAPI.get(submissionId!, courseId);
      setSubmission(response.data as SubmissionReviewData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось изменить оценку"));
    }
  };

  const handleRegrade = async () => {
    try {
      setRegrading(true);
      await submissionsAPI.regrade(submissionId!, courseId);
      toast.success("Работа отправлена на повторную AI-проверку");
      const response = await submissionsAPI.get(submissionId!, courseId);
      setSubmission(response.data as SubmissionReviewData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось запустить переоценку"));
    } finally {
      setRegrading(false);
    }
  };

  if (loading) {
    return (
      <PageShell title="Проверка работы">
        <PageLoader label="Загружаем работу..." />
      </PageShell>
    );
  }

  if (!submission) {
    return null;
  }

  const displayScore = submission.final_score ?? submission.ai_score;
  const scorePercent =
    submission.max_score > 0 && displayScore !== null
      ? (displayScore / submission.max_score) * 100
      : 0;

  const submissionTasks = (submission.tasks ?? [])
    .slice()
    .sort((a, b) => (a.task_type.order_index ?? 0) - (b.task_type.order_index ?? 0));

  return (
    <PageShell
      width="wide"
      backLabel="К списку работ"
      title="Проверка работы"
      subtitle={
        <span>
          {submission.student_name || submission.student_id}
          {submission.student_username && (
            <span className="text-muted-foreground"> @{submission.student_username}</span>
          )}
          {submission.exam && <span> · {submission.exam.title}</span>}
          <span> · сдана {new Date(submission.submitted_at).toLocaleString("ru-RU")}</span>
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge domain="workKind" value={submission.exam?.kind} />
          <StatusBadge domain="submission" value={submission.status} />
          <StatusBadge domain="ocr" value={submission.ocr_overall_status} />
          <StatusBadge domain="llm" value={submission.llm_precheck_status} />
        </div>
      }
    >
      {submission.report_flag && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="font-semibold">
                Студент сообщил об ошибках распознавания
                {totalIssues > 0 && <span className="font-normal text-muted-foreground"> · замечаний: {totalIssues}</span>}
              </p>
              {submission.report_summary && (
                <div className="ocr-rich-text mt-1 text-sm text-muted-foreground">
                  {renderTaskText(submission.report_summary)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(submission.ocr_error || submission.llm_error) && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          {submission.ocr_error && <p>Ошибка OCR: {submission.ocr_error}</p>}
          {submission.llm_error && <p>Ошибка AI: {submission.llm_error}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {/* Единый workspace страниц: фото, OCR-разметка, текст и замечания — в одном месте */}
          <Card className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="section-rule text-xl font-semibold">Работа студента</h2>
              {orderedImages.length > 0 && (
                <div className="inline-flex rounded-md border bg-muted/60 p-0.5">
                  {hasMarkup && (
                    <Button
                      type="button"
                      size="sm"
                      variant={effectiveViewMode === "markup" ? "secondary" : "ghost"}
                      className={cn("h-8 gap-1.5", effectiveViewMode === "markup" && "bg-card shadow-soft")}
                      onClick={() => setViewMode("markup")}
                    >
                      <ScanText className="h-4 w-4" />
                      Разметка
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant={effectiveViewMode === "photo" ? "secondary" : "ghost"}
                    className={cn("h-8 gap-1.5", effectiveViewMode === "photo" && "bg-card shadow-soft")}
                    onClick={() => setViewMode("photo")}
                  >
                    <FileImage className="h-4 w-4" />
                    Фото
                  </Button>
                  {hasOcrText && (
                    <Button
                      type="button"
                      size="sm"
                      variant={effectiveViewMode === "text" ? "secondary" : "ghost"}
                      className={cn("h-8 gap-1.5", effectiveViewMode === "text" && "bg-card shadow-soft")}
                      onClick={() => setViewMode("text")}
                    >
                      Текст OCR
                    </Button>
                  )}
                </div>
              )}
            </div>

            {orderedImages.length === 0 ? (
              <EmptyState
                icon={Images}
                title="Изображения не загружены"
                description="Студент не прикрепил ни одной страницы решения."
              />
            ) : (
              <>
                {orderedImages.length > 1 && (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {orderedImages.map((image, index) => {
                      const page = ocrPageByImageId.get(image.id);
                      const pageIssues = issuesByImageId.get(image.id) ?? [];
                      return (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setActivePageIndex(index)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            index === activePageIndex
                              ? "border-accent/50 bg-accent/10 text-accent"
                              : "bg-card text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          Стр. {index + 1}
                          {page?.page_status === "reported" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-warning" title="С замечаниями" />
                          )}
                          {page?.page_status === "approved" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-success" title="Подтверждена" />
                          )}
                          {pageIssues.length > 0 && (
                            <span className="font-mono text-[10px]">{pageIssues.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentImage && (
                  <div className="space-y-4">
                    {effectiveViewMode === "markup" && (
                      <div className="flex flex-col items-start gap-4 xl:flex-row">
                        <div className="w-fit max-w-full">
                          <OcrImageOverlay
                            imageUrl={imageUrls[currentImage.id]}
                            blocks={currentBlocks}
                            selectedChunkIndex={selectedChunkIndex}
                            onSelectChunk={(index) =>
                              setSelectedChunkByImage((prev) => ({
                                ...prev,
                                [currentImage.id]: index,
                              }))
                            }
                            alt={`Страница ${activePageIndex + 1}`}
                            className="max-h-[75vh]"
                          />
                        </div>

                        <div className="w-full min-w-0 space-y-3 xl:w-[340px] xl:flex-none">
                          <div className="rounded-md border bg-card p-2.5">
                            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                              Выбранный блок
                            </p>
                            <div className="ocr-rich-text max-h-36 overflow-auto text-xs leading-snug">
                              {selectedChunkText
                                ? renderTaskText(selectedChunkText)
                                : "Кликните на блок на изображении или выберите его в списке."}
                            </div>
                          </div>
                          <ChunkListPanel
                            blocks={currentBlocks}
                            selectedIndex={selectedChunkIndex}
                            onSelect={(index) =>
                              setSelectedChunkByImage((prev) => ({
                                ...prev,
                                [currentImage.id]: index,
                              }))
                            }
                            listMaxHeight="max-h-[52vh]"
                            hideEmpty
                          />
                        </div>
                      </div>
                    )}

                    {effectiveViewMode === "photo" && (
                      <div className="relative w-fit max-w-full overflow-hidden rounded-md border bg-muted/30">
                        {imageUrls[currentImage.id] ? (
                          <>
                            <img
                              src={imageUrls[currentImage.id]}
                              alt={`Страница ${activePageIndex + 1}`}
                              className="max-h-[75vh] w-auto max-w-full cursor-zoom-in object-contain"
                              style={{
                                transform: `rotate(${imageAngles[currentImage.id] || 0}deg) scale(${imageScales[currentImage.id] || 1})`,
                                transformOrigin: "center center",
                              }}
                              onClick={() => openLightbox(currentImage.id)}
                            />
                            <div className="absolute right-2 top-2 flex gap-1 rounded-md bg-card/90 p-1 shadow-soft backdrop-blur">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => rotateImage(currentImage.id, -90)}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => rotateImage(currentImage.id, 90)}>
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => zoomImage(currentImage.id, -0.25)}>
                                <ZoomOut className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => zoomImage(currentImage.id, 0.25)}>
                                <ZoomIn className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex h-64 w-96 max-w-full items-center justify-center">
                            <p className="text-sm text-muted-foreground">Загружаем изображение...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {effectiveViewMode === "text" && (
                      <OcrMarkdownPanel
                        markdown={currentOcrPage?.ocr_markdown}
                        alwaysExpanded
                        hideToggle
                        previewLines={9999}
                      />
                    )}

                    {currentIssues.length > 0 && (
                      <div className="space-y-2 border-t pt-4">
                        <h3 className="text-sm font-semibold">
                          Замечания студента к распознаванию · {currentIssues.length}
                        </h3>
                        <div className="grid gap-2 md:grid-cols-2">
                          {currentIssues.map((issue) => (
                            <OcrIssueCard key={issue.id} issue={issue} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Задачи варианта */}
          <Card className="p-4 sm:p-6">
            <h2 className="section-rule mb-4 text-xl font-semibold">Задание студента</h2>
            {submissionTasks.length > 0 ? (
              <div className="space-y-3">
                {submissionTasks.map((task, index) => {
                  const descriptionText = (task.task_type.description || "").trim();
                  const variantText = (task.variant.content || "").trim();
                  const hasDescription = Boolean(descriptionText);
                  const hasVariant = Boolean(variantText);
                  const isVariantDuplicate =
                    hasDescription &&
                    hasVariant &&
                    normalizeTaskText(descriptionText) === normalizeTaskText(variantText);

                  return (
                    <div key={`${task.task_type.id}-${index}`} className="space-y-2.5 rounded-md border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          Задача {index + 1}. {task.task_type.title}
                        </h3>
                        {typeof task.task_type.max_score === "number" && (
                          <span className="whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {task.task_type.max_score} б.
                          </span>
                        )}
                      </div>

                      {isVariantDuplicate ? (
                        <div className="task-rich-text text-sm">{renderTaskText(descriptionText)}</div>
                      ) : (
                        <>
                          {descriptionText && (
                            <div>
                              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Общее условие
                              </p>
                              <div className="task-rich-text text-sm">{renderTaskText(descriptionText)}</div>
                            </div>
                          )}
                          <div className="rounded-md border-l-2 border-accent/60 bg-accent/5 p-3">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">
                              Вариант студента
                            </p>
                            <div className="task-rich-text text-sm">
                              {variantText ? renderTaskText(variantText) : "Текст варианта не передан."}
                            </div>
                          </div>
                        </>
                      )}

                      {Array.isArray(task.task_type.formulas) && task.task_type.formulas.length > 0 && (
                        <div className="rounded-md bg-info/5 p-3">
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-info">
                            Справочные формулы
                          </p>
                          <div className="space-y-1 text-sm">
                            {task.task_type.formulas.map((formula, formulaIndex) => (
                              <div key={`${task.task_type.id}-formula-${formulaIndex}`}>
                                {renderLatex(formula)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Текст задания для этой работы не получен.</p>
            )}
          </Card>

          {/* AI-анализ */}
          {submission.llm_precheck_status === "failed" ? (
            <Card className="p-4 sm:p-6">
              <h2 className="section-rule mb-4 text-xl font-semibold">Отчёт AI-проверки</h2>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">AI-проверка не выполнилась</p>
                    <p className="text-sm text-muted-foreground">
                      Попробуйте переоценить или выставьте балл вручную — работа студента от этого не пострадает.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRegrade} disabled={regrading}>
                  <RefreshCw className={cn("h-4 w-4", regrading && "animate-spin")} />
                  Повторить AI-проверку
                </Button>
              </div>
            </Card>
          ) : submission.llm_precheck_status !== "skipped" && (
            <Card className="p-4 sm:p-6">
              <h2 className="section-rule mb-4 text-xl font-semibold">Отчёт AI-проверки</h2>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Общее</TabsTrigger>
                  <TabsTrigger value="criteria">По критериям</TabsTrigger>
                  <TabsTrigger value="details">Детали</TabsTrigger>
                  {submission.ai_analysis?.full_transcription_md && (
                    <TabsTrigger value="transcription">Расшифровка</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="overview" className="space-y-4 pt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl font-semibold">
                      {submission.ai_score ?? "—"}
                    </span>
                    <span className="text-muted-foreground">/ {submission.max_score} — оценка AI</span>
                  </div>
                  {submission.ai_comments && (
                    <div className="rounded-md bg-secondary/50 p-4 text-sm">
                      <div className="whitespace-pre-wrap">{renderLatex(submission.ai_comments)}</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="criteria" className="pt-2">
                  {submission.scores && submission.scores.length > 0 ? (
                    <div className="space-y-4">
                      {submission.scores.map((score, index) => {
                        const percent =
                          score.max_score > 0 ? ((score.ai_score ?? 0) / score.max_score) * 100 : 0;
                        return (
                          <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">{score.criterion_name}</h4>
                              <span className="whitespace-nowrap font-mono text-sm">
                                {score.ai_score ?? 0} / {score.max_score}
                              </span>
                            </div>
                            <Progress value={percent} className="mb-2 h-1.5" />
                            {score.ai_comment && (
                              <div className="text-sm text-muted-foreground">
                                {renderLatex(score.ai_comment)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Детализации по критериям нет.</p>
                  )}
                </TabsContent>

                <TabsContent value="details" className="pt-2">
                  {submission.ai_analysis ? (
                    <AiAnalysis data={submission.ai_analysis} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Детальный анализ недоступен.</p>
                  )}
                </TabsContent>

                {submission.ai_analysis?.full_transcription_md && (
                  <TabsContent value="transcription" className="pt-2">
                    <div className="ocr-rich-text whitespace-pre-wrap text-sm">
                      {renderLatex(submission.ai_analysis.full_transcription_md)}
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </Card>
          )}

          {submission.is_flagged && submission.flag_reasons.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">Системные отметки</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                    {submission.flag_reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky-панель оценки */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Итоговая оценка
            </h3>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="override_score">Балл</Label>
                  <Input
                    id="override_score"
                    type="number"
                    min={0}
                    max={submission.max_score}
                    step={0.5}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(parseFloat(e.target.value))}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Максимум: {submission.max_score}
                  </p>
                </div>

                <div>
                  <Label htmlFor="teacher_comments">Комментарий студенту</Label>
                  <Textarea
                    id="teacher_comments"
                    value={teacherComments}
                    onChange={(e) => setTeacherComments(e.target.value)}
                    placeholder="Что получилось, что исправить..."
                    rows={5}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleOverride} className="flex-1">
                    <CheckCircle className="h-4 w-4" />
                    Сохранить
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-5xl font-semibold leading-none">
                      {displayScore ?? "—"}
                    </span>
                    <span className="text-muted-foreground">/ {submission.max_score}</span>
                  </div>
                  {displayScore !== null && (
                    <Progress value={scorePercent} className="mt-3 h-1.5" />
                  )}
                  {submission.final_score !== null && submission.ai_score !== null &&
                    submission.final_score !== submission.ai_score && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Оценка AI: {submission.ai_score} — изменена преподавателем
                    </p>
                  )}
                </div>

                {submission.teacher_comments && (
                  <div className="rounded-md bg-secondary/50 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Ваш комментарий</p>
                    <div>{renderLatex(submission.teacher_comments)}</div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {submission.status !== "approved" && submission.ai_score !== null && (
                    <Button onClick={handleApprove} variant="success" className="w-full">
                      <CheckCircle className="h-4 w-4" />
                      Принять оценку AI
                    </Button>
                  )}
                  <Button onClick={() => setEditing(true)} variant="outline" className="w-full">
                    <Edit3 className="h-4 w-4" />
                    {submission.ai_score === null ? "Выставить балл" : "Изменить оценку"}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Действия
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRegrade}
                disabled={
                  regrading ||
                  submission.status === "processing" ||
                  submission.llm_precheck_status === "skipped"
                }
              >
                <RefreshCw className={cn("h-4 w-4", regrading && "animate-spin")} />
                {regrading ? "Отправляем..." : "Переоценить AI"}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages.map((item) => item.url)}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </PageShell>
  );
};

export default SubmissionReview;
