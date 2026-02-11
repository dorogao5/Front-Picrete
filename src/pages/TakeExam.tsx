import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Upload, CheckCircle, AlertCircle, Image as ImageIcon, Trash2, Smartphone } from "lucide-react";
import { getApiErrorMessage, getApiErrorStatus, materialsAPI, submissionsAPI, type SessionImage, type WorkKind } from "@/lib/api";
import { toast } from "sonner";
import { renderLatex } from "@/lib/renderLatex";

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
          toast.error("Загрузка изображений не завершилась за 30 секунд. Дождитесь завершения и повторите.");
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
      toast.error(getApiErrorMessage(error, "Ошибка при отправке работы"));
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
          toast.error("Часть загрузок еще выполняется, отправляем работу с уже загруженными изображениями.");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const response = await submissionsAPI.submit(sessionId, courseId);
      const payload = response.data as SubmitResponse;
      const nextStep = await resolveSubmitNextStep(sessionId, payload.next_step);
      toast.success("Работа автоматически отправлена");
      navigateAfterSubmit(sessionId, nextStep);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при автоматической отправке работы"));
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
          prev.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  status: "uploaded",
                }
              : item
          )
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
                  status: "error",
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
        toast.error("Загрузка недоступна для завершенной сессии");
        return;
      }

      if (!files || files.length === 0) return;

      const accepted = Array.from(files).filter(
        (file) => file.type === "image/jpeg" || file.type === "image/png"
      );

      if (accepted.length === 0) {
        toast.error("Разрешены только JPEG и PNG");
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
        toast.success("Изображение удалено");
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Не удалось удалить изображение"));
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
      toast.error(getApiErrorMessage(error, "Не удалось открыть дополнительные материалы"));
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
          toast.error(getApiErrorMessage(error, "Ошибка при входе в экзамен"));
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
      <div className="min-h-screen bg-gradient-subtle">
        <Navbar />
        <div className="container mx-auto px-6 pt-24 pb-12">
          <p>Загрузка экзамена...</p>
        </div>
      </div>
    );
  }

  const total = initialRemainingRef.current ?? timeRemaining ?? 0;
  const progressPercent =
    total > 0 && timeRemaining !== null ? (timeRemaining / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />

      {isTimedWork && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-background border-b shadow-md">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">Оставшееся время:</span>
                <span
                  className={`text-2xl font-mono ${
                    (timeRemaining ?? 0) < 600 ? "text-red-500" : "text-primary"
                  }`}
                >
                  {timeRemaining !== null ? formatTime(timeRemaining) : "--:--:--"}
                </span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || isTimeUp || hasUploadsInProgress}
                variant="default"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isTimeUp ? "Время истекло" : "Завершить работу"}
              </Button>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </div>
      )}

      <div className={`container mx-auto px-6 pb-12 ${isTimedWork ? "pt-40" : "pt-24"}`}>
        {!isTimedWork && hardDeadline && (
          <Alert className="mb-6 border-blue-400 bg-blue-50 dark:bg-blue-950">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Домашняя работа без таймера. Жесткий дедлайн:{" "}
              {new Date(hardDeadline).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}.
            </AlertDescription>
          </Alert>
        )}

        {serverImages.length > 0 && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Уже загружено на сервер: {serverImages.length} изображений.
            </AlertDescription>
          </Alert>
        )}

        {isTimedWork && timeRemaining !== null && timeRemaining < 600 && timeRemaining > 0 && !isTimeUp && (
          <Alert className="mb-6 border-red-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Осталось менее 10 минут! Не забудьте завершить работу.
            </AlertDescription>
          </Alert>
        )}

        {isTimeUp && (
          <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Время экзамена истекло! Все действия заблокированы. Работа отправляется автоматически.
            </AlertDescription>
          </Alert>
        )}

        {!isTimedWork && (
          <div className="mb-6 flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || isTimeUp || hasUploadsInProgress}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Сдать домашнюю работу
            </Button>
          </div>
        )}

        <div className="mb-6 flex justify-end">
          <Button variant="outline" onClick={handleOpenMaterials} disabled={openingMaterials}>
            {openingMaterials ? "Открытие..." : "Дополнительные материалы"}
          </Button>
        </div>

        <div className="space-y-8">
          {tasks.map((task, index) => {
            const descriptionText = (task.task_type.description || "").trim();
            const variantText = (task.variant.content || "").trim();
            const showVariantBlock = variantText.length > 0 && variantText !== descriptionText;

            return (
              <Card key={task.task_type.id} className="p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">
                      Задача {index + 1}. {task.task_type.title}
                    </h2>
                    <span className="text-sm font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
                      {task.task_type.max_score} баллов
                    </span>
                  </div>

                  <div className="prose max-w-none">
                    <p className="text-muted-foreground mb-4">
                      {renderLatex(task.task_type.description)}
                    </p>

                    {showVariantBlock && (
                      <div className="bg-secondary/50 p-4 rounded-lg mb-4">
                        <h3 className="font-semibold mb-2">Ваш вариант:</h3>
                        <div>{renderLatex(task.variant.content)}</div>
                      </div>
                    )}
                  </div>

                  {task.task_type.formulas.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
                      <h4 className="font-semibold mb-2">Формулы:</h4>
                      <div className="space-y-1">
                        {task.task_type.formulas.map((formula: string, i: number) => (
                          <div key={i}>{renderLatex(formula)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 mt-8">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Фото решения
          </h3>

          <div className="mb-4">
            <label className="block">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  canModifyImages
                    ? "cursor-pointer hover:border-primary"
                    : "cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800"
                }`}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {canModifyImages
                    ? "Нажмите или перетащите изображения (JPEG, PNG). Файлы отправляются сразу."
                    : "Загрузка недоступна для завершенной сессии"}
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
          </div>

          {uploadQueue.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium mb-2">Текущие загрузки</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="border rounded-lg overflow-hidden">
                    <img src={item.previewUrl} alt={item.file.name} className="w-full h-32 object-cover" />
                    <div className="p-2 text-xs">
                      <div className="truncate">{item.file.name}</div>
                      <div className="mt-1">
                        {item.status === "uploading" && "Загрузка..."}
                        {item.status === "uploaded" && "Загружено"}
                        {item.status === "error" && (
                          <span className="text-red-500">Ошибка: {item.error || "неизвестно"}</span>
                        )}
                      </div>
                      {item.status === "error" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => handleRemoveQueueItem(item.id)}
                        >
                          Убрать
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm font-medium mb-2">Загруженные изображения</p>
          {serverImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет загруженных изображений.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {serverImages.map((image) => (
                <div key={image.id} className="relative border rounded-lg overflow-hidden group">
                  {image.view_url ? (
                    <img
                      src={image.view_url}
                      alt={image.filename}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-secondary text-muted-foreground text-xs px-2 text-center">
                      {image.filename}
                    </div>
                  )}
                  {canModifyImages && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteServerImage(image.id)}
                      disabled={deletingImageId === image.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center truncate">
                    #{image.order_index + 1} · {image.upload_source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 mt-4 border-dashed">
          <p className="text-sm flex items-start gap-2 text-muted-foreground">
            <Smartphone className="w-4 h-4 mt-0.5" />
            Можно загружать фото с телефона через Telegram-бота. Сначала начните работу на сайте, затем в боте: /login → /works → /use.
          </p>
        </Card>

        <div className="fixed bottom-6 right-6">
          <Card className="p-3 shadow-lg">
            <p className="text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Автосохранение активно
            </p>
          </Card>
        </div>
      </div>

      {isTimedWork && (
        <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-red-500" />
                Время истекло
              </DialogTitle>
              <DialogDescription>
                Время экзамена закончилось. Работа отправлена на проверку.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleTimeoutConfirm} className="w-full">
                Понятно
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TakeExam;
