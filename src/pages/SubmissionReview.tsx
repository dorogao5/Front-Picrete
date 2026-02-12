import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import OcrImageOverlay from "@/components/OcrImageOverlay";
import OcrMarkdownPanel from "@/components/OcrMarkdownPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Edit3, AlertTriangle, RotateCcw, RotateCw, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { getApiErrorMessage, submissionsAPI } from "@/lib/api";
import { toast } from "sonner";
import ImageLightbox from "@/components/ImageLightbox";
import AiAnalysis from "@/components/AiAnalysis";
import { renderLatex, renderTaskText } from "@/lib/renderLatex";
import {
  anchorSummary,
  chunkDisplayText,
  cleanOcrMarkdown,
  extractOcrBlocks,
  OcrChunkBlock,
} from "@/lib/ocr";

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
  ocr_pages?: Array<{
    image_id: string;
    order_index?: number;
    ocr_status?: string;
    ocr_markdown?: string | null;
    chunks?: unknown;
    page_status?: "approved" | "reported" | null;
    issues?: Array<{
      id: string;
      image_id: string;
      anchor: Record<string, unknown>;
      original_text?: string | null;
      suggested_text?: string | null;
      note: string;
      severity: "minor" | "major" | "critical";
      created_at: string;
    }>;
  }>;
  report_issues?: Array<{
    id: string;
    image_id: string;
    anchor: Record<string, unknown>;
    original_text?: string | null;
    suggested_text?: string | null;
    note: string;
    severity: "minor" | "major" | "critical";
    created_at: string;
  }>;
  tasks?: SubmissionTask[];
  exam?: {
    id: string;
    title: string;
    kind?: "control" | "homework";
  };
}

const chunkTitle = (block: OcrChunkBlock, index: number) => {
  const kind = typeof block.block_type === "string" && block.block_type.trim() ? block.block_type : "chunk";
  const page = typeof block.page === "number" ? ` • page ${block.page}` : "";
  return `${kind} #${index + 1}${page}`;
};

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
  const [hideOcrImageByImage, setHideOcrImageByImage] = useState<Record<string, boolean>>({});
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

        // Load presigned URLs for all images
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
            toast.error(`Не удалось получить URL для ${failedImageIds.length} изображений`);
          }
        }
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Ошибка при загрузке работы"));
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) {
      loadSubmission();
    }
  }, [courseId, submissionId, navigate]);

  const rotateImage = (id: string, delta: number) => {
    setImageAngles((prev) => ({ ...prev, [id]: ((prev[id] || 0) + delta) % 360 }));
  };

  const zoomImage = (id: string, delta: number) => {
    setImageScales((prev) => {
      const next = Math.min(3, Math.max(0.5, (prev[id] || 1) + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleApprove = async () => {
    try {
      await submissionsAPI.approve(submissionId!, { teacher_comments: teacherComments }, courseId);
      toast.success("Работа утверждена");
      navigate(-1);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при утверждении"));
    }
  };

  const handleOverride = async () => {
    try {
      await submissionsAPI.overrideScore(submissionId!, {
        final_score: overrideScore,
        teacher_comments: teacherComments || "", // backend требует строку
      }, courseId);
      toast.success("Оценка изменена");
      setEditing(false);
      const response = await submissionsAPI.get(submissionId!, courseId);
      setSubmission(response.data as SubmissionReviewData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при изменении оценки"));
    }
  };

  const handleRegrade = async () => {
    try {
      setRegrading(true);
      await submissionsAPI.regrade(submissionId!, courseId);
      toast.success("Работа отправлена на повторную проверку AI");
      // Reload submission to reflect new status
      const response = await submissionsAPI.get(submissionId!, courseId);
      setSubmission(response.data as SubmissionReviewData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при запросе переоценки"));
    } finally {
      setRegrading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <p>Загрузка работы...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return null;
  }

  const scorePercent = submission.max_score > 0
    ? ((submission.final_score || submission.ai_score || 0) / submission.max_score) * 100
    : 0;

  const imageOrderById = new Map<string, number>();
  submission.images.forEach((image, index) => {
    imageOrderById.set(image.id, (image.order_index ?? index) + 1);
  });

  const submissionTasks = (submission.tasks ?? [])
    .slice()
    .sort((a, b) => (a.task_type.order_index ?? 0) - (b.task_type.order_index ?? 0));

  const lightboxImages = submission.images
    .map((image) => ({ id: image.id, url: imageUrls[image.id] }))
    .filter((item): item is { id: string; url: string } => Boolean(item.url));
  const lightboxIndexByImageId = new Map<string, number>();
  lightboxImages.forEach((item, idx) => {
    lightboxIndexByImageId.set(item.id, idx);
  });

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />

      <div className="container mx-auto px-6 pt-24 pb-12">
          <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Проверка работы</h1>
            <p className="text-muted-foreground">
              Студент: {submission.student_name || submission.student_id} (@{submission.student_username || "unknown"}) | Сдано:{" "}
              {new Date(submission.submitted_at).toLocaleString("ru-RU")}
            </p>
            {submission.exam && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{submission.exam.title}</span>
                {submission.exam.kind && (
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      submission.exam.kind === "homework"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {submission.exam.kind === "homework" ? "Домашняя" : "Контрольная"}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Статус</p>
            <p className="text-lg font-semibold">{submission.status}</p>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {submission.report_flag && <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">REPORT</span>}
              {submission.ocr_overall_status === "failed" && (
                <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700">OCR failed</span>
              )}
              {submission.llm_precheck_status === "skipped" && (
                <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">LLM skipped</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Задачи и вариант студента</h2>
              {submissionTasks.length > 0 ? (
                <div className="space-y-4">
                  {submissionTasks.map((task, index) => {
                    const descriptionText = (task.task_type.description || "").trim();
                    const variantText = (task.variant.content || "").trim();

                    return (
                      <div key={`${task.task_type.id}-${index}`} className="rounded border p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold">
                            Задача {index + 1}. {task.task_type.title}
                          </h3>
                          {typeof task.task_type.max_score === "number" && (
                            <span className="text-xs font-semibold rounded bg-primary/10 px-2 py-1 text-primary">
                              {task.task_type.max_score} баллов
                            </span>
                          )}
                        </div>

                        {descriptionText && (
                          <div className="rounded border bg-secondary/30 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Общее условие
                            </p>
                            <div className="text-sm">{renderTaskText(descriptionText)}</div>
                          </div>
                        )}

                        <div className="rounded border border-primary/30 bg-primary/5 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                            Вариант этого студента
                          </p>
                          <div className="text-sm">
                            {variantText ? renderTaskText(variantText) : "Текст варианта не передан API."}
                          </div>
                        </div>

                        {Array.isArray(task.task_type.formulas) && task.task_type.formulas.length > 0 && (
                          <div className="rounded border bg-blue-50 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">
                              Формулы
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
                <p className="text-sm text-muted-foreground">
                  Текст варианта для этой работы не получен от API.
                </p>
              )}
            </Card>

            {/* Images */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Загруженные изображения</h2>
              {submission.images && submission.images.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {submission.images.map((image, index) => (
                    <div key={image.id} className="border rounded-lg overflow-hidden">
                      {imageUrls[image.id] ? (
                        <div className="relative">
                          <img
                            src={imageUrls[image.id]}
                            alt={`Page ${index + 1}`}
                            className="w-full h-auto cursor-zoom-in"
                            style={{ transform: `rotate(${imageAngles[image.id] || 0}deg) scale(${imageScales[image.id] || 1})`, transformOrigin: 'center center' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                            onClick={() => {
                              const nextIndex = lightboxIndexByImageId.get(image.id);
                              if (typeof nextIndex === "number") {
                                setLightboxIndex(nextIndex);
                              } else {
                                setLightboxIndex(0);
                              }
                              setLightboxOpen(true);
                            }}
                          />
                          <div className="absolute top-2 right-2 flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => rotateImage(image.id, -90)}><RotateCcw className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => rotateImage(image.id, 90)}><RotateCw className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => zoomImage(image.id, -0.25)}><ZoomOut className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => zoomImage(image.id, 0.25)}><ZoomIn className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-64 bg-secondary flex items-center justify-center">
                          <p className="text-muted-foreground">Загрузка изображения...</p>
                        </div>
                      )}
                      <div className="p-2 bg-secondary text-xs">
                        <p>Страница {index + 1}</p>
                        {(image.ocr_markdown || image.ocr_text) && (
                          <p className="mt-1 text-[10px] line-clamp-2 text-muted-foreground">
                            OCR: {cleanOcrMarkdown(image.ocr_markdown || image.ocr_text).slice(0, 120)}
                          </p>
                        )}
                        {image.quality_score && (
                          <p>Качество: {(image.quality_score * 100).toFixed(0)}%</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Изображения не загружены</p>
              )}
            </Card>

            {lightboxOpen && (
              <ImageLightbox
                images={lightboxImages.map((item) => item.url)}
                startIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
              />
            )}

            {/* AI Analysis */}
            {submission.llm_precheck_status !== "skipped" && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Анализ AI</h2>

                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Общее</TabsTrigger>
                    <TabsTrigger value="criteria">По критериям</TabsTrigger>
                    <TabsTrigger value="details">Детали</TabsTrigger>
                    {submission.ai_analysis?.full_transcription_md && (
                      <TabsTrigger value="transcription">Расшифровка</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div>
                      <Label>AI Score:</Label>
                      <p className="text-3xl font-bold">
                        {submission.ai_score || 0} / {submission.max_score}
                      </p>
                    </div>
                    {submission.ai_comments && (
                      <div>
                        <Label>Комментарии AI:</Label>
                        <div className="bg-secondary/50 p-4 rounded mt-2">
                          <div className="whitespace-pre-wrap">{renderLatex(submission.ai_comments)}</div>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="criteria">
                    {submission.scores && submission.scores.length > 0 ? (
                      <div className="space-y-4">
                        {submission.scores.map((score, index) => (
                          <div key={index} className="border-b pb-4 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">{score.criterion_name}</h4>
                              <span className="font-bold">
                                {score.ai_score || 0} / {score.max_score}
                              </span>
                            </div>
                            {score.ai_comment && (
                              <div className="text-sm text-muted-foreground">
                                {renderLatex(score.ai_comment)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Нет детализации по критериям</p>
                    )}
                  </TabsContent>

                  <TabsContent value="details">
                    {submission.ai_analysis ? (
                      <AiAnalysis data={submission.ai_analysis} />
                    ) : (
                      <p className="text-muted-foreground">Детальный анализ недоступен</p>
                    )}
                  </TabsContent>

                  {submission.ai_analysis?.full_transcription_md && (
                    <TabsContent value="transcription">
                      <div className="prose max-w-none">
                        <div className="whitespace-pre-wrap">{renderLatex(submission.ai_analysis.full_transcription_md)}</div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </Card>
            )}

            {/* Flags */}
            {submission.is_flagged && submission.flag_reasons.length > 0 && (
              <Card className="p-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Системные отметки
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  {submission.flag_reasons.map((reason: string, i: number) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            {/* Score Card */}
            <Card className="p-6 bg-gradient-card">
              <h3 className="font-semibold mb-4">Итоговая оценка</h3>

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
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Максимум: {submission.max_score}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="teacher_comments">Комментарии</Label>
                    <Textarea
                      id="teacher_comments"
                      value={teacherComments}
                      onChange={(e) => setTeacherComments(e.target.value)}
                      placeholder="Оставьте комментарий для студента..."
                      rows={6}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleOverride} className="flex-1">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Сохранить
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                      className="flex-1"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-4xl font-bold">
                      {submission.final_score || submission.ai_score || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      из {submission.max_score} ({scorePercent.toFixed(1)}%)
                    </p>
                  </div>

                  {submission.teacher_comments && (
                    <div className="bg-secondary/50 p-3 rounded text-sm">
                      <p className="font-semibold mb-1">Ваш комментарий:</p>
                      <p>{renderLatex(submission.teacher_comments)}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => setEditing(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Изменить оценку
                    </Button>

                    {submission.status !== "approved" && (
                      <Button onClick={handleApprove} className="w-full">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Утвердить
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Действия</h3>
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
                  <RefreshCw className={`w-4 h-4 mr-2 ${regrading ? 'animate-spin' : ''}`} />
                  {regrading ? "Отправка..." : "Переоценить AI"}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
                  Назад к списку
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="text-2xl font-bold mb-4">OCR / REPORT</h2>
          <Tabs defaultValue="ocr">
            <TabsList>
              <TabsTrigger value="ocr">OCR (validated)</TabsTrigger>
              <TabsTrigger value="report">Student REPORT issues</TabsTrigger>
            </TabsList>

            <TabsContent value="ocr" className="space-y-4">
              {submission.ocr_error && (
                <div className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
                  OCR error: {submission.ocr_error}
                </div>
              )}
              {submission.ocr_pages && submission.ocr_pages.length > 0 ? (
                <div className="space-y-4">
                  {submission.ocr_pages.map((page, idx) => {
                    const blocks = extractOcrBlocks(page.chunks);
                    const selectedChunkIndex =
                      selectedChunkByImage[page.image_id] ?? (blocks.length > 0 ? 0 : null);
                    const selectedBlock =
                      selectedChunkIndex !== null ? blocks[selectedChunkIndex] ?? null : null;
                    const selectedChunkText = selectedBlock ? chunkDisplayText(selectedBlock) : "";
                    const hideImage = hideOcrImageByImage[page.image_id] ?? false;

                    return (
                      <div key={`${page.image_id}-${idx}`} className="rounded border p-3 space-y-3">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <span className="font-medium">Страница #{idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {page.ocr_status || "unknown"} / {page.page_status || "not_reviewed"}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setHideOcrImageByImage((prev) => ({
                                  ...prev,
                                  [page.image_id]: !hideImage,
                                }))
                              }
                            >
                              {hideImage ? "Показать изображение" : "Скрыть изображение"}
                            </Button>
                          </div>
                        </div>

                        {hideImage ? (
                          <OcrMarkdownPanel
                            markdown={page.ocr_markdown}
                            alwaysExpanded
                            hideToggle
                            previewLines={9999}
                          />
                        ) : (
                          <div className="flex flex-col items-start gap-4 xl:flex-row">
                            <div className="w-fit max-w-full">
                              <OcrImageOverlay
                                imageUrl={imageUrls[page.image_id]}
                                blocks={blocks}
                                selectedChunkIndex={selectedChunkIndex}
                                onSelectChunk={(index) =>
                                  setSelectedChunkByImage((prev) => ({
                                    ...prev,
                                    [page.image_id]: index,
                                  }))
                                }
                                alt={`OCR page ${idx + 1}`}
                                className="max-h-[72vh]"
                              />
                            </div>

                            <div className="min-w-0 w-full space-y-3 xl:w-[360px] xl:flex-none">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground">
                                  OCR chunks с привязкой геометрии
                                </p>
                                <div className="max-h-[46vh] overflow-y-auto rounded border p-2 space-y-2">
                                  {blocks.map((block, blockIndex) => {
                                    const renderedChunk = chunkDisplayText(block);
                                    return (
                                      <button
                                        key={`${page.image_id}-chunk-${blockIndex}`}
                                        type="button"
                                        className={`w-full rounded border p-2 text-left text-xs ${
                                          selectedChunkIndex === blockIndex
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:bg-muted/50"
                                        }`}
                                        onClick={() =>
                                          setSelectedChunkByImage((prev) => ({
                                            ...prev,
                                            [page.image_id]: blockIndex,
                                          }))
                                        }
                                      >
                                        <div className="font-medium">{chunkTitle(block, blockIndex)}</div>
                                        <div className="mt-1 max-h-24 overflow-auto rounded bg-background/70 p-1.5 text-muted-foreground">
                                          <div className="ocr-rich-text text-[11px] leading-snug">
                                            {renderedChunk ? renderTaskText(renderedChunk) : "(пустой OCR блок)"}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                  {blocks.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      OCR chunks отсутствуют в ответе.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="rounded border bg-background/70 p-2">
                                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                                  Выбранный chunk
                                </p>
                                <div className="ocr-rich-text max-h-40 overflow-auto text-xs leading-snug">
                                  {selectedChunkText
                                    ? renderTaskText(selectedChunkText)
                                    : "Выберите chunk в списке справа или кликните на bbox/полигон на изображении."}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">OCR-данные не предоставлены</p>
              )}
            </TabsContent>

            <TabsContent value="report" className="space-y-3">
              {submission.report_summary && (
                <div className="rounded border p-3 text-sm">
                  <p className="font-semibold mb-1">Summary</p>
                  <p className="text-muted-foreground">{submission.report_summary}</p>
                </div>
              )}
              {submission.report_issues && submission.report_issues.length > 0 ? (
                <div className="space-y-3">
                  {submission.report_issues.map((issue) => (
                    <div key={issue.id} className="rounded border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Страница #{imageOrderById.get(issue.image_id) ?? "?"}
                        </span>
                        <span className="text-xs uppercase text-muted-foreground">{issue.severity}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {anchorSummary(issue.anchor)}
                      </p>
                      <p className="mt-2">{issue.note}</p>
                      {issue.original_text && (
                        <p className="mt-1 text-muted-foreground">
                          OCR: {cleanOcrMarkdown(issue.original_text)}
                        </p>
                      )}
                      {issue.suggested_text && (
                        <p className="mt-1 text-muted-foreground">
                          corrected: {issue.suggested_text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">REPORT issues отсутствуют</p>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default SubmissionReview;
