import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { examsAPI, getApiErrorStatus } from "@/lib/api";
import type { WorkKind } from "@/lib/api";
import { toast } from "sonner";

interface ExamSummary {
  id: string;
  title: string;
  kind: WorkKind;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  status: string;
  task_count: number;
  student_count: number;
  pending_count: number;
}

const TeacherDashboard = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | WorkKind>("all");
  const [publishingExamId, setPublishingExamId] = useState<string | null>(null);

  useEffect(() => {
    const fetchExams = async () => {
      if (!courseId) {
        setLoading(false);
        return;
      }
      try {
        const response = await examsAPI.list(courseId);
        setExams(response.data.items);
      } catch (error: unknown) {
        // Не показываем ошибку для 401 - interceptor сам обработает редирект
        if (getApiErrorStatus(error) === 401) {
          setLoading(false);
          return;
        }
        // Для других ошибок показываем уведомление
        toast.error("Ошибка загрузки работ");
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [courseId]);

  if (!courseId) {
    return null;
  }

  const handlePublishExam = async (examId: string) => {
    if (!courseId) return;
    setPublishingExamId(examId);
    try {
      await examsAPI.publish(examId, courseId);
      const response = await examsAPI.list(courseId);
      setExams(response.data.items);
      toast.success("Работа опубликована");
    } catch {
      toast.error("Не удалось опубликовать работу");
    } finally {
      setPublishingExamId(null);
    }
  };

  const filteredExams =
    kindFilter === "all" ? exams : exams.filter((exam) => exam.kind === kindFilter);

  // Calculate statistics
  const stats = {
    total: filteredExams.length,
    active: filteredExams.filter(e => e.status === 'active' || e.status === 'published').length,
    pendingReview: filteredExams.reduce((sum, e) => sum + e.pending_count, 0),
    completed: filteredExams.reduce((sum, e) => sum + (e.student_count - e.pending_count), 0),
    control: filteredExams.filter((e) => e.kind === "control").length,
    homework: filteredExams.filter((e) => e.kind === "homework").length,
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Панель преподавателя</h1>
            <p className="text-muted-foreground">Управление работами и проверка решений</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/c/${courseId}/task-bank`}>
              <Button variant="outline" size="lg">
                Банк задач
              </Button>
            </Link>
            <Link to={`/c/${courseId}/create-exam`}>
              <Button size="lg" className="shadow-elegant">
                <Plus className="w-5 h-5 mr-2" />
                Создать работу
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button
            variant={kindFilter === "all" ? "default" : "outline"}
            onClick={() => setKindFilter("all")}
          >
            Все
          </Button>
          <Button
            variant={kindFilter === "control" ? "default" : "outline"}
            onClick={() => setKindFilter("control")}
          >
            Контрольные
          </Button>
          <Button
            variant={kindFilter === "homework" ? "default" : "outline"}
            onClick={() => setKindFilter("homework")}
          >
            Домашние
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            Контрольных: {stats.control}, домашних: {stats.homework}
          </span>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? "..." : stats.total}</p>
                <p className="text-sm text-muted-foreground">Всего работ</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? "..." : stats.active}</p>
                <p className="text-sm text-muted-foreground">Активные</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? "..." : stats.pendingReview}</p>
                <p className="text-sm text-muted-foreground">Требуют проверки</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-border/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{loading ? "..." : stats.completed}</p>
                <p className="text-sm text-muted-foreground">Проверено</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Exams List */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Работы</h2>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : filteredExams.length === 0 ? (
            <Card className="p-12 text-center bg-gradient-card border-border/50">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Работ пока нет</h3>
              <p className="text-muted-foreground mb-6">Создайте первую работу</p>
              <Link to={`/c/${courseId}/create-exam`}>
                <Button>
                  <Plus className="w-5 h-5 mr-2" />
                  Создать работу
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredExams.map((exam) => {
                const getStatusLabel = (status: string) => {
                  switch (status) {
                    case 'active': return 'Активна';
                    case 'published': return 'Опубликована';
                    case 'draft': return 'Черновик';
                    case 'completed': return 'Завершена';
                    default: return status;
                  }
                };
                const kindLabel = exam.kind === "homework" ? "Домашняя" : "Контрольная";
                const kindClass =
                  exam.kind === "homework"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-blue-50 text-blue-700 border-blue-200";

                const isActive = exam.status === 'active' || exam.status === 'published';

                return (
                  <Card key={exam.id} className="p-6 hover:shadow-elegant transition-all duration-300 border-border/50 bg-gradient-card">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold">{exam.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${kindClass}`}>
                            {kindLabel}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            isActive
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {getStatusLabel(exam.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span>Дата: {new Date(exam.start_time).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" })}</span>
                          <span>Студентов: {exam.student_count}</span>
                          <span>Задач: {exam.task_count}</span>
                          {exam.pending_count > 0 && (
                            <span className="text-primary font-medium">
                              {exam.pending_count} требуют проверки
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {exam.status === "draft" && (
                          <Button
                            variant="outline"
                            onClick={() => handlePublishExam(exam.id)}
                            disabled={publishingExamId === exam.id}
                          >
                            {publishingExamId === exam.id ? "Публикация..." : "Опубликовать"}
                          </Button>
                        )}
                        <Link to={`/c/${courseId}/exam/${exam.id}/submissions`}>
                          <Button variant="outline">Проверка</Button>
                        </Link>
                        <Link to={`/c/${courseId}/exam/${exam.id}/edit`}>
                          <Button variant="ghost">Редактировать</Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
