import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Dumbbell, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageLoader, PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage, trainerAPI } from "@/lib/api";
import type { TrainerSetSummary } from "@/lib/api";

const TrainerSets = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<TrainerSetSummary[]>([]);

  const loadSets = useCallback(async () => {
    if (!courseId) {
      return;
    }
    setLoading(true);
    try {
      const response = await trainerAPI.listSets(courseId, { limit: 200 });
      setSets((response.data.items ?? []) as TrainerSetSummary[]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка загрузки тренажёров"));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const deleteSet = async (setId: string) => {
    if (!courseId) {
      return;
    }
    try {
      await trainerAPI.deleteSet(setId, courseId);
      toast.success("Набор удалён");
      await loadSets();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка удаления набора"));
    }
  };

  if (!courseId) {
    return null;
  }

  return (
    <PageShell
      title="Мои тренажёры"
      subtitle="Сохранённые наборы задач для тренировки"
      actions={
        <Link to={`/c/${courseId}/task-bank`}>
          <Button variant="accent" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            Открыть банк задач
          </Button>
        </Link>
      }
    >
      {loading ? (
        <PageLoader label="Загружаем наборы..." />
      ) : sets.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Наборов пока нет"
          description="Соберите первый набор в банке задач — вручную или автоматической подборкой."
          action={
            <Link to={`/c/${courseId}/task-bank`}>
              <Button variant="accent" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Собрать набор
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <Card key={set.id} className="p-5 transition-shadow hover:shadow-elegant">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{set.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span>{set.source_title}</span>
                    <span>Задач: {set.item_count}</span>
                    <span>
                      Создан:{" "}
                      {new Date(set.created_at).toLocaleString("ru-RU", {
                        timeZone: "Europe/Moscow",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/c/${courseId}/trainer/${set.id}`}>
                    <Button variant="outline">Открыть</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => deleteSet(set.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default TrainerSets;
