import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Upload, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { getApiErrorMessage, getApiErrorStatus, submissionsAPI } from "@/lib/api";
import { toast } from "sonner";
import { renderLatex } from "@/lib/renderLatex";

interface ExamSession {
  id: string;
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
  tasks: SessionTask[];
  time_remaining: number;
  existing_images?: ExistingServerImage[];
}

interface SubmitResponse {
  next_step?: "ocr_review" | "result";
}

const TakeExam = () => {
  const { courseId, examId } = useParams<{ courseId: string; examId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<ExamSession | null>(null);
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<{ [key: number]: File[] }>({});
  /** Images already on server (e.g. after refresh) — not re-uploaded, shown as "загружено" */
  const [existingServerImages, setExistingServerImages] = useState<
    { id: string; filename: string; order_index: number }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const sessionId = session?.id;
  const initialRemainingRef = useRef<number | null>(null);
  /** Refs so timer/auto-submit always see latest state (avoids stale closure → no_images) */
  const uploadedImagesRef = useRef(uploadedImages);
  const existingServerImagesRef = useRef(existingServerImages);
  uploadedImagesRef.current = uploadedImages;
  existingServerImagesRef.current = existingServerImages;

  // Stable object-URL cache: maps File → objectURL, revoked on unmount
  const objectUrlCache = useRef<Map<File, string>>(new Map());

  const getObjectUrl = useCallback((file: File): string => {
    const cache = objectUrlCache.current;
    let url = cache.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      cache.set(file, url);
    }
    return url;
  }, []);

  // Revoke all cached object-URLs on unmount
  useEffect(() => {
    const cache = objectUrlCache.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  // Helper functions
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Upload images function (reads current files from ref so auto-submit always uploads latest)
  const uploadImages = useCallback(async () => {
    if (!sessionId || isTimeUp) return;

    const current = uploadedImagesRef.current;
    const totalNew = Object.values(current).reduce((sum, files) => sum + files.length, 0);
    if (totalNew === 0) return;

    setUploading(true);
    try {
      const baseOrder = existingServerImagesRef.current.length;
      let orderIndex = baseOrder;
      for (const taskIndex in current) {
        const files = current[taskIndex];
        for (const file of files) {
          await submissionsAPI.uploadImage(sessionId, file, orderIndex, courseId);
          orderIndex++;
        }
      }
      toast.success("Все изображения загружены");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при загрузке изображений"));
      throw error;
    } finally {
      setUploading(false);
    }
  }, [courseId, sessionId, isTimeUp]);

  // Auto-submit: use refs so we always see latest images (avoids stale closure → no_images)
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

  const handleAutoSubmit = useCallback(async () => {
    if (!sessionId || submitting) return;

    setSubmitting(true);
    try {
      const currentNew = uploadedImagesRef.current;
      const totalNewImages = Object.values(currentNew).reduce(
        (sum, files) => sum + files.length,
        0
      );
      if (totalNewImages > 0) {
        await uploadImages();
      }
      // Always submit (with or without images) so teacher sees the attempt
      const response = await submissionsAPI.submit(sessionId, courseId);
      const payload = response.data as SubmitResponse;
      toast.success("Работа автоматически отправлена");
      navigateAfterSubmit(sessionId, payload.next_step);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при автоматической отправке работы"));
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, submitting, uploadImages, courseId, navigateAfterSubmit]);

  // Event handlers
  const handleTimeoutConfirm = useCallback(() => {
    setShowTimeoutDialog(false);
    if (sessionId) {
      navigate(courseId ? `/c/${courseId}/exam/${sessionId}/result` : "/dashboard");
    }
  }, [courseId, sessionId, navigate]);

  const handleImageSelect = useCallback((taskIndex: number, files: FileList | null) => {
    if (isTimeUp) {
      toast.error("Время экзамена истекло. Действия заблокированы.");
      return;
    }

    if (!files) return;

    const newFiles = Array.from(files).filter(
      (file) => file.type === "image/jpeg" || file.type === "image/png"
    );

    setUploadedImages((prev) => ({
      ...prev,
      [taskIndex]: [...(prev[taskIndex] || []), ...newFiles],
    }));

    toast.success(`Добавлено ${newFiles.length} изображений`);
  }, [isTimeUp]);

  const removeImage = useCallback((taskIndex: number, imageIndex: number) => {
    if (isTimeUp) {
      toast.error("Время экзамена истекло. Действия заблокированы.");
      return;
    }

    setUploadedImages((prev) => {
      const removed = prev[taskIndex]?.[imageIndex];
      if (removed) {
        const url = objectUrlCache.current.get(removed);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlCache.current.delete(removed);
        }
      }
      return {
        ...prev,
        [taskIndex]: prev[taskIndex].filter((_, i) => i !== imageIndex),
      };
    });
  }, [isTimeUp]);

  const handleSubmit = useCallback(async () => {
    if (!sessionId || isTimeUp) return;

    const totalNew = Object.values(uploadedImages).reduce(
      (sum, files) => sum + files.length,
      0
    );

    setSubmitting(true);
    try {
      if (totalNew > 0) {
        await uploadImages();
      }

      const response = await submissionsAPI.submit(sessionId, courseId);
      const payload = response.data as SubmitResponse;
      toast.success("Работа отправлена на проверку");
      navigateAfterSubmit(sessionId, payload.next_step);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка при отправке работы"));
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, isTimeUp, uploadedImages, uploadImages, navigateAfterSubmit, courseId]);

  // Load session and variant
  useEffect(() => {
    const enterExam = async () => {
      try {
        const response = await submissionsAPI.enterExam(examId!, courseId);
        const sessionData = response.data as ExamSession;
        setSession(sessionData);

        const variantResponse = await submissionsAPI.getSessionVariant(sessionData.id, courseId);
        const variantData = variantResponse.data as SessionVariantResponse;
        setTasks(variantData.tasks);
        setTimeRemaining(variantData.time_remaining);
        initialRemainingRef.current = variantData.time_remaining;
        setExistingServerImages(variantData.existing_images ?? []);
      } catch (error: unknown) {
        if (getApiErrorStatus(error) !== 401) {
          toast.error(getApiErrorMessage(error, "Ошибка при входе в экзамен"));
          navigate(courseId ? `/c/${courseId}/student` : "/dashboard");
        }
      }
    };

    if (examId && courseId) {
      enterExam();
    }
  }, [courseId, examId, navigate]);

  // Timer countdown with auto-submit
  useEffect(() => {
    if (timeRemaining <= 0 || isTimeUp) {
      return;
    }
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          setIsTimeUp(true);
          setShowTimeoutDialog(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, isTimeUp, handleAutoSubmit]);

  // Server-side auto-save every 30 seconds
  useEffect(() => {
    if (!sessionId || isTimeUp) return;

    const interval = setInterval(async () => {
      const totalImages = Object.values(uploadedImages).reduce(
        (sum, files) => sum + files.length,
        0
      );
      try {
        await submissionsAPI.autoSave(sessionId, {
          imageCount: totalImages,
          savedAt: new Date().toISOString(),
        }, courseId);
      } catch {
        // Auto-save is best-effort; failures are silent
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [courseId, sessionId, uploadedImages, isTimeUp]);

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

  const total = initialRemainingRef.current ?? timeRemaining;
  const progressPercent = total > 0 ? (timeRemaining / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />

      {/* Timer Bar */}
      <div className="fixed top-16 left-0 right-0 z-40 bg-background border-b shadow-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">Оставшееся время:</span>
              <span
                className={`text-2xl font-mono ${
                  timeRemaining < 600 ? "text-red-500" : "text-primary"
                }`}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploading || isTimeUp}
              variant="default"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isTimeUp ? "Время истекло" : "Завершить работу"}
            </Button>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      <div className="container mx-auto px-6 pt-40 pb-12">
        {/* Warning if low time */}
        {existingServerImages.length > 0 && (
          <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Уже загружено на сервер ({existingServerImages.length}):{" "}
              {existingServerImages.map((img) => img.filename).join(", ")}
            </AlertDescription>
          </Alert>
        )}

        {timeRemaining < 600 && timeRemaining > 0 && !isTimeUp && (
          <Alert className="mb-6 border-red-500">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Осталось менее 10 минут! Не забудьте завершить работу.
            </AlertDescription>
          </Alert>
        )}

        {/* Time up warning */}
        {isTimeUp && (
          <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Время экзамена истекло! Все действия заблокированы. Работа будет автоматически отправлена.
            </AlertDescription>
          </Alert>
        )}

        {/* Tasks */}
        <div className="space-y-8">
          {tasks.map((task, index) => (
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

                  <div className="bg-secondary/50 p-4 rounded-lg mb-4">
                    <h3 className="font-semibold mb-2">Ваш вариант:</h3>
                    <div>{renderLatex(task.variant.content)}</div>
                  </div>
                </div>

                {/* Formulas reference */}
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

              {/* Image Upload */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Загрузите фото решения
                </h3>

                <div className="mb-4">
                  <label className="block">
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isTimeUp
                        ? 'cursor-not-allowed opacity-50 bg-gray-100 dark:bg-gray-800'
                        : 'cursor-pointer hover:border-primary'
                    }`}>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isTimeUp
                          ? "Время истекло - загрузка заблокирована"
                          : "Нажмите или перетащите изображения (JPEG, PNG)"
                        }
                      </p>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png"
                        onChange={(e) => handleImageSelect(index, e.target.files)}
                        disabled={isTimeUp}
                        className="hidden"
                      />
                    </div>
                  </label>
                </div>

                {/* Preview uploaded images */}
                {uploadedImages[index] && uploadedImages[index].length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedImages[index].map((file, imgIndex) => (
                      <div
                        key={imgIndex}
                        className="relative border rounded-lg overflow-hidden group"
                      >
                        <img
                          src={getObjectUrl(file)}
                          alt={`Uploaded ${imgIndex + 1}`}
                          className="w-full h-32 object-cover"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index, imgIndex)}
                          disabled={isTimeUp}
                        >
                          Удалить
                        </Button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Auto-save indicator */}
        <div className="fixed bottom-6 right-6">
          <Card className="p-3 shadow-lg">
            <p className="text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Автосохранение активно
            </p>
          </Card>
        </div>
      </div>

      {/* Timeout Dialog */}
      <Dialog open={showTimeoutDialog} onOpenChange={setShowTimeoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-red-500" />
              Время истекло
            </DialogTitle>
            <DialogDescription>
              Время экзамена закончилось. Работа будет автоматически отправлена на проверку.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={handleTimeoutConfirm} className="w-full">
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TakeExam;
