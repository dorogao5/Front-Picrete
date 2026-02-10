import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage, trainerAPI } from "@/lib/api";
import type { TrainerSetSummary } from "@/lib/api";
import { toast } from "sonner";

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
      toast.error(getApiErrorMessage(error, "Ошибка загрузки тренажеров"));
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
      toast.success("Набор удален");
      await loadSets();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка удаления набора"));
    }
  };

  if (!courseId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Мои тренажеры</h1>
            <p className="text-muted-foreground">Сохраненные наборы задач</p>
          </div>
          <Link to={`/c/${courseId}/task-bank`}>
            <Button>Открыть банк задач</Button>
          </Link>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Загрузка...</p>
          </Card>
        ) : sets.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Тренажерных наборов пока нет</p>
            <Link to={`/c/${courseId}/task-bank`}>
              <Button>Создать набор</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {sets.map((set) => (
              <Card key={set.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">{set.title}</h2>
                    <p className="text-sm text-muted-foreground mb-2">
                      {set.source_title} • задач: {set.item_count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Создан: {new Date(set.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/c/${courseId}/trainer/${set.id}`}>
                      <Button variant="outline">Открыть</Button>
                    </Link>
                    <Button variant="destructive" onClick={() => deleteSet(set.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerSets;
