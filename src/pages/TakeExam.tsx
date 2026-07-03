import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Loader2,
  Send,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { PageShell, PageLoader } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getApiErrorMessage,
  getApiErrorStatus,
  materialsAPI,
  submissionsAPI,
  type SessionImage,
  type WorkKind,
} from "@/lib/api";
import { renderLatex, renderTaskText } from "@/lib/renderLatex";
import { cn } from "@/lib/utils";

interface ExamSession {
  id: string;
  status?: "active" | "submitted" | "expired" | "graded";
}

interface ExistingServerImage {
  id: string;
  filename: string;
  order_index: number;
}

interface SessionTaskType {
  id: string;
  title: string;
  description: string;
  max_score: number;
  formulas: string[];
}

interface SessionTaskVariant {
  content: string;
}

interface SessionTask {
  task_type: SessionTaskType;
  variant: SessionTaskVariant;
}

interface SessionVariantResponse {
  work_kind: WorkKind;
  hard_deadline: string;
  tasks: SessionTask[];
  time_remaining: number | null;
  existing_images?: ExistingServerImage[];
}

interface SubmitResponse {
  next_step?: "ocr_review" | "result";
}

interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "uploaded" | "error";
  error?: string;
}

const TakeExam = () => {
  const { courseId, examId } = useParams<{ courseId: string; examId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [workKind, setWorkKind] = useState<WorkKind>("control");
  const [hardDeadline, setHardDeadline] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [serverImages, setServerImages] = useState<SessionImage[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const [openingMaterials, setOpeningMaterials] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const sessionId = session?.id;
  const isTimedWork = workKind === "control";
  const initialRemainingRef = useRef<number | null>(null);
  const uploadQueueRef = useRef<UploadQueueItem[]>([]);

  const uploadingCount = useMemo(
    () => uploadQueue.filter((item) => item.status === "uploading").length,
    [uploadQueue]
  );

  uploadQueueRef.current = uploadQueue;

  const canModifyImages = !isTimeUp && session?.status !== "submitted" && session?.status !== "expired";
  const hasUploadsInProgress = uploadingCount > 0;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const refreshSessionImages = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await submissionsAPI.listSessionImages(sessionId, courseId);
      setServerImages(response.data.items || []);
    } catch {
      // polling is best-effort
    }
  }, [courseId, sessionId]);

  const resolveSubmitNextStep = useCallback(
    async (
      submittedSessionId: string,
      nextStep?: "ocr_review" | "result"
    ): Promise<"ocr_review" | "result"> => {
      if (nextStep) {
        return nextStep;
      }

      try {
        const resultResponse = await submissionsAPI.getResult(submittedSessionId, courseId);
        const ocrStatus = (resultResponse.data as { ocr_overall_status?: string }).ocr_overall_status;
        if (ocrStatus && ocrStatus !== "not_required") {
          return "ocr_review";
        }
      } catch {
        // fallback to result route
      }

      return "result";
    },
    [courseId]
  );

  const navigateAfterSubmit = useCallback(
    (submittedSessionId: string, nextStep?: "ocr_review" | "result") => {
      if (nextStep === "ocr_review") {
        navigate(courseId ? `/c/${courseId}/exam/${submittedSessionId}/ocr-review` : "/dashboard");
        return;
      }
      navigate(courseId ? `/c/${courseId}/exam/${submittedSessionId}/result` : "/dashboard");
    },
    [courseId, navigate]
  );

  const handleSubmit = useCallback(async () => {
    if (!sessionId || isTimeUp || submitting) return;

    setSubmitting(true);
    try {
      const waitStartedAt = Date.now();
      while (uploadQueueRef.current.some((item) => item.status === "uploading")) {
        if (Date.now() - waitStartedAt >= 30_000) {
          toast.error("Загрузка фото не завершилась за 30 секунд. Дождитесь завершения и повторите.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const response = await submissionsAPI.submit(sessionId, courseId);
      const payload = response.data as SubmitResponse;
      const nextStep = await resolveSubmitNextStep(sessionId, payload.next_step);
      toast.success("Работа отправлена на проверку");
      navigateAfterSubmit(sessionId, nextStep);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось отправить работу"));
    } finally {
      setSubmitting(false);
    }
  }, [courseId, isTimeUp, navigateAfterSubmit, resolveSubmitNextStep, sessionId, submitting]);

  const handleAutoSubmit = useCallback(async () => {
    if (!sessionId || submitting) return;

    setSubmitting(true);
    try {
      const waitStartedAt = Date.now();
      while (uploadQueueRef.current.some((item) => item.status === "uploading")) {
        if (Date.now() - waitStartedAt >= 30_000) {
          toast.error("Часть загрузок ещё выполняется — отправляем работу с уже сохранёнными фото.");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const response = await submissionsAPI.submit(sessionId, courseId);
      const payload = response.data as SubmitResponse;
      const nextStep = await resolveSubmitNextStep(sessionId, payload.next_step);
      toast.success("Время вышло — работа отправлена автоматически");
      navigateAfterSubmit(sessionId, nextStep);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось автоматически отправить работу"));
    } finally {
      setSubmitting(false);
    }
  }, [courseId, navigateAfterSubmit, resolveSubmitNextStep, sessionId, submitting]);

  const uploadSingleFile = useCallback(
    async (queueId: string, file: File) => {
      if (!sessionId) return;

      try {
        await submissionsAPI.uploadImage(sessionId, file, undefined, courseId);
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === queueId ? { ...item, status: "uploaded" as const } : item))
        );
        await refreshSessionImages();

        setTimeout(() => {
          setUploadQueue((prev) => {
            const current = prev.find((item) => item.id === queueId);
            if (current) {
              URL.revokeObjectURL(current.previewUrl);
            }
            return prev.filter((item) => item.id !== queueId);
          });
        }, 900);
      } catch (error: unknown) {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  status: "error" as const,
                  error: getApiErrorMessage(error, "Ошибка загрузки"),
                }
              : item
          )
        );
      }
    },
    [courseId, refreshSessionImages, sessionId]
  );

  const handleFilesSelected = useCallback(
    (files: FileList | null) => {
      if (!canModifyImages) {
        toast.error("Работа уже завершена — загрузка недоступна");
        return;
      }

      if (!files || files.length === 0) return;

      const accepted = Array.from(files).filter(
        (file) => file.type === "image/jpeg" || file.type === "image/png"
      );

      if (accepted.length === 0) {
        toast.error("Подходят только фото в JPEG или PNG");
        return;
      }

      const queued: UploadQueueItem[] = accepted.map((file, idx) => ({
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));

      setUploadQueue((prev) => [...prev, ...queued]);
      queued.forEach((item) => {
        void uploadSingleFile(item.id, item.file);
      });
    },
    [canModifyImages, uploadSingleFile]
  );

  const handleRemoveQueueItem = useCallback((queueId: string) => {
    setUploadQueue((prev) => {
      const item = prev.find((entry) => entry.id === queueId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((entry) => entry.id !== queueId);
    });
  }, []);

  const handleDeleteServerImage = useCallback(
    async (imageId: string) => {
      if (!sessionId) return;

      setDeletingImageId(imageId);
      try {
        await submissionsAPI.deleteSessionImage(sessionId, imageId, courseId);
        await refreshSessionImages();
        toast.success("Фото удалено");
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось удалить фото"));
      } finally {
        setDeletingImageId(null);
      }
    },
    [courseId, refreshSessionImages, sessionId]
  );

  const handleOpenMaterials = useCallback(async () => {
    if (!courseId) return;
    setOpeningMaterials(true);
    try {
      await materialsAPI.openAdditionPdf(courseId);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось открыть справочные материалы"));
    } finally {
      setOpeningMaterials(false);
    }
  }, [courseId]);

  const handleTimeoutConfirm = useCallback(async () => {
    setShowTimeoutDialog(false);
    if (sessionId) {
      try {
        const resultResponse = await submissionsAPI.getResult(sessionId, courseId);
        const ocrStatus = (resultResponse.data as { ocr_overall_status?: string }).ocr_overall_status;
        if (ocrStatus && ocrStatus !== "not_required") {
          navigate(courseId ? `/c/${courseId}/exam/${sessionId}/ocr-review` : "/dashboard");
          return;
        }
      } catch {
        // ignore
      }
      navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard");
    }
  }, [courseId, navigate, sessionId]);

  useEffect(() => {
    const enterExam = async () => {
      try {
        const response = await submissionsAPI.enterExam(examId!, courseId);
        const sessionData = response.data as ExamSession;
        setSession(sessionData);

        const variantResponse = await submissionsAPI.getSessionVariant(sessionData.id, courseId);
        const variantData = variantResponse.data as SessionVariantResponse;

        setTasks(variantData.tasks);
        setWorkKind(variantData.work_kind ?? "control");
        setHardDeadline(variantData.hard_deadline ?? null);
        setTimeRemaining(variantData.time_remaining);
        initialRemainingRef.current = variantData.time_remaining;
        setIsTimeUp(false);
        setShowTimeoutDialog(false);

        try {
          const imagesResponse = await submissionsAPI.listSessionImages(sessionData.id, courseId);
          setServerImages(imagesResponse.data.items || []);
        } catch {
          // Legacy fallback through existing_images while backend rollout is in progress
          setServerImages(
            (variantData.existing_images || []).map((item) => ({
              id: item.id,
              filename: item.filename,
              mime_type: "image/jpeg",
              file_size: 0,
              order_index: item.order_index,
              upload_source: "web",
              uploaded_at: new Date().toISOString(),
              view_url: null,
            }))
          );
        }
      } catch (error: unknown) {
        if (getApiErrorStatus(error) !== 401) {
          toast.error(getApiErrorMessage(error, "Не удалось открыть работу"));
          navigate(courseId ? `/c/${courseId}/student` : "/dashboard");
        }
      }
    };

    if (examId && courseId) {
      void enterExam();
    }
  }, [courseId, examId, navigate]);

  useEffect(() => {
    if (!isTimedWork || timeRemaining === null || timeRemaining <= 0 || isTimeUp) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          void handleAutoSubmit();
          setIsTimeUp(true);
          setShowTimeoutDialog(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handleAutoSubmit, isTimeUp, isTimedWork, timeRemaining]);

  useEffect(() => {
    if (!sessionId || isTimeUp) return;

    const interval = setInterval(async () => {
      try {
        await submissionsAPI.autoSave(
          sessionId,
          {
            imageCount: serverImages.length,
            uploadsInProgress: uploadingCount,
            savedAt: new Date().toISOString(),
          },
          courseId
        );
      } catch {
        // best-effort autosave
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [courseId, isTimeUp, serverImages.length, sessionId, uploadingCount]);

  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      void refreshSessionImages();
    }, 5_000);

    return () => clearInterval(interval);
  }, [refreshSessionImages, sessionId]);

  useEffect(() => {
    return () => {
      uploadQueueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  if (!session || tasks.length === 0) {
    return (
      <PageShell title="Работа">
        <PageLoader label="Открываем вашу работу..." />
      </PageShell>
    );
  }

  const total = initialRemainingRef.current ?? timeRemaining ?? 0;
  const progressPercent = total > 0 && timeRemaining !== null ? (timeRemaining / total) * 100 : 0;
  const lowTime = isTimedWork && timeRemaining !== null && timeRemaining < 600 && !isTimeUp;

  return (
    <PageShell
      width="wide"
      title={isTimedWork ? "Контрольная работа" : "Домашняя работа"}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge domain="workKind" value={workKind} />
          {!isTimedWork && hardDeadline && (
            <span>
              Дедлайн: {new Date(hardDeadline).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
            </span>
          )}
        </span>
      }
      actions={
        <Button variant="outline" onClick={handleOpenMaterials} disabled={openingMaterials} className="gap-1.5">
          <BookOpen className="h-4 w-4" />
          {openingMaterials ? "Открываем..." : "Справочные материалы"}
        </Button>
      }
    >
      {isTimeUp && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Время вышло — работа отправляется автоматически, действия заблокированы.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Задачи */}
        <div className="min-w-0 space-y-4">
          {tasks.map((task, index) => {
            const descriptionText = (task.task_type.description || "").trim();
            const variantText = (task.variant.content || "").trim();
            const showVariantBlock = variantText.length > 0 && variantText !== descriptionText;

            return (
              <Card key={task.task_type.id} className="p-5 sm:p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    Задача {index + 1}. {task.task_type.title}
                  </h2>
                  <span className="whitespace-nowrap rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                    {task.task_type.max_score} б.
                  </span>
                </div>

                {descriptionText && (
                  <div className="task-rich-text mb-3 text-sm leading-relaxed">
                    {renderTaskText(task.task_type.description)}
                  </div>
                )}

                {showVariantBlock && (
                  <div className="mb-3 rounded-md border-l-2 border-accent/60 bg-accent/5 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">
                      Ваш вариант
                    </p>
                    <div className="task-rich-text text-sm">{renderTaskText(task.variant.content)}</div>
                  </div>
                )}

                {task.task_type.formulas.length > 0 && (
                  <div className="rounded-md bg-info/5 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-info">
                      Справочные формулы
                    </p>
                    <div className="space-y-1 text-sm">
                      {task.task_type.formulas.map((formula: string, i: number) => (
                        <div key={i}>{renderLatex(formula)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Sticky-панель: таймер, загрузка, отправка */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          {isTimedWork && (
            <Card className={cn("p-5", lowTime && "border-destructive/50")}>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Осталось времени
                </span>
              </div>
              <p
                className={cn(
                  "mt-1 font-mono text-4xl font-semibold tabular-nums",
                  lowTime ? "text-destructive" : "text-foreground"
                )}
              >
                {timeRemaining !== null ? formatTime(timeRemaining) : "--:--:--"}
              </p>
              <Progress
                value={progressPercent}
                className={cn("mt-3 h-1.5", lowTime && "[&>div]:bg-destructive")}
              />
              {lowTime && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  Меньше 10 минут — не забудьте завершить работу
                </p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ImageIcon className="h-4 w-4" />
              Фото решения
              {serverImages.length > 0 && (
                <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  {serverImages.length} загружено
                </span>
              )}
            </h3>

            <label className="block">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (canModifyImages) setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={cn(
                  "rounded-md border-2 border-dashed p-5 text-center transition-colors",
                  canModifyImages
                    ? "cursor-pointer hover:border-accent/60 hover:bg-accent/5"
                    : "cursor-not-allowed bg-muted/50 opacity-60",
                  dragActive && "border-accent bg-accent/10"
                )}
              >
                <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {canModifyImages
                    ? "Нажмите или перетащите фото (JPEG, PNG) — они сохраняются сразу"
                    : "Загрузка недоступна: работа завершена"}
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  disabled={!canModifyImages}
                  className="hidden"
                />
              </div>
            </label>

            {uploadQueue.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-md border p-1.5 text-xs">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="h-9 w-9 flex-shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{item.file.name}</p>
                      {item.status === "uploading" && (
                        <p className="inline-flex items-center gap-1 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Загружаем...
                        </p>
                      )}
                      {item.status === "uploaded" && (
                        <p className="inline-flex items-center gap-1 text-success">
                          <CheckCircle className="h-3 w-3" />
                          Готово
                        </p>
                      )}
                      {item.status === "error" && (
                        <p className="truncate text-destructive">{item.error || "Ошибка"}</p>
                      )}
                    </div>
                    {item.status === "error" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5"
                        onClick={() => handleRemoveQueueItem(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {serverImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {serverImages.map((image) => (
                  <div key={image.id} className="group relative overflow-hidden rounded-md border">
                    {image.view_url ? (
                      <img src={image.view_url} alt={image.filename} className="h-20 w-full object-cover" />
                    ) : (
                      <div className="flex h-20 w-full items-center justify-center bg-secondary px-1 text-center text-[10px] text-muted-foreground">
                        {image.filename}
                      </div>
                    )}
                    {canModifyImages && (
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-card/90 p-1 text-destructive opacity-0 shadow-soft transition-opacity group-hover:opacity-100 disabled:opacity-40"
                        onClick={() => handleDeleteServerImage(image.id)}
                        disabled={deletingImageId === image.id}
                        title="Удалить фото"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-foreground/60 px-1 py-0.5 text-center text-[10px] text-background">
                      #{image.order_index + 1}
                      {image.upload_source === "telegram" && " · TG"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-3 flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Фото можно прислать с телефона через Telegram-бота: /login → /works → /use
            </p>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={submitting || isTimeUp || hasUploadsInProgress}
            variant="accent"
            size="lg"
            className="w-full gap-2"
            title={hasUploadsInProgress ? "Дождитесь завершения загрузки фото" : undefined}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isTimeUp ? "Время истекло" : submitting ? "Отправляем..." : "Сдать работу"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Автосохранение включено — фото сохраняются сразу после загрузки
          </p>
        </aside>
      </div>

      {isTimedWork && (
        <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-destructive" />
                Время истекло
              </DialogTitle>
              <DialogDescription>
                Время работы закончилось. Всё, что вы успели загрузить, отправлено на проверку.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={handleTimeoutConfirm} className="w-full">
                Понятно
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
};

export default TakeExam;
