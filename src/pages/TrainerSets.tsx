import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BookOpen, Dumbbell, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { InlineError } from "@/components/InlineError";
import { PageLoader, PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getApiErrorMessage, trainerAPI } from "@/lib/api";
import type { TrainerSetSummary } from "@/lib/api";

const TrainerSets = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [loading, setLoading] = useState(true);
  const [sets, setSets] = useState<TrainerSetSummary[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "title">("newest");
  const [setToDelete, setSetToDelete] = useState<TrainerSetSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSets = useCallback(async () => {
    if (!courseId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await trainerAPI.listSets(courseId, { limit: 200 });
      setSets((response.data.items ?? []) as TrainerSetSummary[]);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, "Не удалось загрузить тренировочные наборы"));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const deleteSet = async () => {
    const setId = setToDelete?.id;
    if (!courseId) {
      return;
    }
    if (!setId) return;
    setDeleting(true);
    try {
      await trainerAPI.deleteSet(setId, courseId);
      toast.success("Набор удалён");
      setSetToDelete(null);
      await loadSets();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка удаления набора"));
    } finally {
      setDeleting(false);
    }
  };

  const visibleSets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ru-RU");
    const filtered = normalizedSearch
      ? sets.filter((set) =>
          `${set.title} ${set.source_title}`.toLocaleLowerCase("ru-RU").includes(normalizedSearch),
        )
      : sets;

    return [...filtered].sort((left, right) => {
      if (sort === "title") return left.title.localeCompare(right.title, "ru-RU");
      const difference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      return sort === "oldest" ? difference : -difference;
    });
  }, [search, sets, sort]);

  if (!courseId) {
    return null;
  }

  return (
    <PageShell
      title="Мои тренажёры"
      subtitle="Личные подборки для практики — ответы открываются только по вашему действию"
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
      ) : error ? (
        <InlineError description={error} onRetry={loadSets} />
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
        <>
          <Card className="mb-5 p-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Найти набор по названию или источнику"
                  aria-label="Поиск тренировочных наборов"
                  className="pl-9"
                />
              </div>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="h-11 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Сортировка тренировочных наборов"
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="title">По названию</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              Показано {visibleSets.length} из {sets.length}
            </p>
          </Card>

          {visibleSets.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Наборы не найдены"
              description="Попробуйте сократить запрос или очистить поле поиска."
              action={<Button variant="outline" onClick={() => setSearch("")}>Очистить поиск</Button>}
            />
          ) : (
          <div className="space-y-3">
          {visibleSets.map((set) => (
            <Card key={set.id} className="virtualized-card p-5 transition-shadow hover:shadow-elegant">
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
                    onClick={() => setSetToDelete(set)}
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
        </>
      )}

      <AlertDialog open={Boolean(setToDelete)} onOpenChange={(open) => !open && !deleting && setSetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировочный набор?</AlertDialogTitle>
            <AlertDialogDescription>
              «{setToDelete?.title}» исчезнет из списка. Исходные задачи в банке останутся без изменений.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deleteSet();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить набор"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default TrainerSets;
