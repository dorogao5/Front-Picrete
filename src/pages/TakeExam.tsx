import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Upload, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";
import { submissionsAPI } from "@/lib/api";
import { toast } from "sonner";
import { renderLatex } from "@/lib/renderLatex";

const TakeExam = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<{ [key: number]: File[] }>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  const initialRemainingRef = useRef<number | null>(null);

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

  // Upload images function
  const uploadImages = useCallback(async () => {
    if (!session || isTimeUp) return;

    setUploading(true);
    try {
      let orderIndex = 0;
      for (const taskIndex in uploadedImages) {
        const files = uploadedImages[taskIndex];
        for (const file of files) {
          await submissionsAPI.uploadImage(session.id, file, orderIndex);
          orderIndex++;
        }
      }
      toast.success("Все изображения загружены");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Ошибка при загрузке изображений");
    } finally {
      setUploading(false);
    }
  }, [session?.id, isTimeUp, uploadedImages]);

  // Auto-submit function
  const handleAutoSubmit = useCallback(async () => {
    if (!session || submitting) return;

    try {
      setSubmitting(true);

      const totalImages = Object.values(uploadedImages).reduce(
        (sum, files) => sum + files.length,
        0
      );

      if (totalImages > 0) {
        await uploadImages();
      }

      await submissionsAPI.submit(session.id);
      toast.success("Работа автоматически отправлена");
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Ошибка при автоматической отправке работы";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
      navigate(`/exam/${session.id}/result`);
    }
  }, [session?.id, submitting, uploadedImages, uploadImages, navigate]);

  // Event handlers
  const handleTimeoutConfirm = useCallback(() => {
    setShowTimeoutDialog(false);
    if (session) {
      navigate(`/exam/${session.id}/result`);
    }
  }, [session?.id, navigate]);

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
    if (!session || isTimeUp) return;

    const totalImages = Object.values(uploadedImages).reduce(
      (sum, files) => sum + files.length,
      0
    );

    setSubmitting(true);
    try {
      if (totalImages > 0) {
        await uploadImages();
      }

      await submissionsAPI.submit(session.id);
      toast.success("Работа отправлена на проверку");
      navigate(`/exam/${session.id}/result`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || "Ошибка при отправке работы";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [session?.id, isTimeUp, uploadedImages, uploadImages, navigate]);

  // Load session and variant
  useEffect(() => {
    const enterExam = async () => {
      try {
        const response = await submissionsAPI.enterExam(examId!);
        const sessionData = response.data;
        setSession(sessionData);

        const variantResponse = await submissionsAPI.getSessionVariant(sessionData.id);
        setTasks(variantResponse.data.tasks);
        setTimeRemaining(variantResponse.data.time_remaining);
        initialRemainingRef.current = variantResponse.data.time_remaining;
      } catch (error: any) {
        if (error.response?.status !== 401) {
          toast.error(error.response?.data?.detail || "Ошибка при входе в экзамен");
          navigate("/student");
        }
      }
    };

    if (examId) {
      enterExam();
    }
  }, [examId, navigate]);

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
    if (!session?.id || isTimeUp) return;

    const interval = setInterval(async () => {
      const totalImages = Object.values(uploadedImages).reduce(
        (sum, files) => sum + files.length,
        0
      );
      try {
        await submissionsAPI.autoSave(session.id, {
          imageCount: totalImages,
          savedAt: new Date().toISOString(),
        });
      } catch {
        // Auto-save is best-effort; failures are silent
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [session?.id, uploadedImages, isTimeUp]);

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
