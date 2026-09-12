import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  Plus,
  Dumbbell,
  GraduationCap,
} from "lucide-react";
import { PageShell, PageLoader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InlineError } from "@/components/InlineError";
import { EmptyState } from "@/components/EmptyState";
import {
  getApiErrorMessage,
  trainerAPI,
  type TrainerSetSummary,
} from "@/lib/api";
import { hasCourseRole, isAdmin } from "@/lib/auth";
import { practice, completion, type Trainer } from "@/lib/practice";
export default function TrainerCatalog() {
  const { courseId = "" } = useParams();
  const teacher = isAdmin() || hasCourseRole(courseId, "teacher");
  const [items, setItems] = useState<Trainer[]>([]);
  const [sets, setSets] = useState<TrainerSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalog, personal] = await Promise.all([
        practice.catalog(courseId, teacher),
        teacher ? Promise.resolve(null) : trainerAPI.listSets(courseId),
      ]);
      setItems(catalog);
      setSets(personal?.data.items ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить тренажёры"));
    } finally {
      setLoading(false);
    }
  }, [courseId, teacher]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <PageShell
      title="Тренажёры"
      subtitle={
        teacher
          ? "Подготовьте практику по темам курса. Студенты смогут решать задачи и разбирать их с ИИ."
          : "Практикуйтесь в своём темпе: выбирайте тему, задавайте вопросы и пробуйте снова."
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to={`/c/${courseId}/task-bank`}>
              <BookOpen className="h-4 w-4" />
              Банк задач
            </Link>
          </Button>
          {teacher && (
            <Button variant="accent" asChild>
              <Link to={`/c/${courseId}/trainer/manage/new`}>
                <Plus className="h-4 w-4" />
                Создать тренажёр
              </Link>
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <PageLoader />
      ) : error ? (
        <InlineError description={error} onRetry={load} />
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold">
              {teacher ? "Практика для студентов" : "От преподавателя"}
            </h2>
            <span className="text-sm text-muted-foreground">
              {items.length}
            </span>
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={
                teacher
                  ? "Соберите первую тему"
                  : "Преподаватель ещё не опубликовал тренажёры"
              }
              description={
                teacher
                  ? "Добавьте подтемы и подберите задачи по сложности."
                  : "Пока можно выбрать задачи в банке и создать свой набор."
              }
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {items.map((t) => {
                const p = completion(t);
                return (
                  <Link
                    key={t.id}
                    to={`/c/${courseId}/trainer/${teacher ? "manage" : "course"}/${t.id}`}
                    className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-elegant">
                      <div className="h-1 bg-accent" />
                      <div className="flex flex-1 flex-col p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Подтем: {t.definition.sections.length}
                          </span>
                          {teacher ? (
                            <span
                              className={`rounded-full px-3 py-1 text-sm ${t.published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                            >
                              {t.published ? "Опубликован" : "Черновик"}
                            </span>
                          ) : (
                            <ArrowUpRight className="h-5 w-5 text-accent transition-transform group-hover:-translate-y-0.5" />
                          )}
                        </div>
                        <h3 className="mb-2 text-2xl font-semibold">
                          {t.definition.title}
                        </h3>
                        <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {t.definition.description ||
                            "Практика с подсказками и проверкой решения"}
                        </p>
                        <div className="mt-auto">
                          {teacher ? (
                            <p className="text-sm text-accent">
                              Настроить содержание →
                            </p>
                          ) : (
                            <>
                              <div className="mb-2 flex justify-between text-sm">
                                <span>
                                  {p.done
                                    ? "Продолжить практику"
                                    : "Начать с любой подтемы"}
                                </span>
                                <span>
                                  {p.done} / {p.target}
                                </span>
                              </div>
                              <div
                                role="progressbar"
                                aria-label="Основная практика"
                                aria-valuenow={p.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-1.5 overflow-hidden rounded-full bg-muted"
                              >
                                <div
                                  className="h-full bg-accent"
                                  style={{ width: `${p.percent}%` }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
          {!teacher && (
            <section className="mt-12 border-t pt-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-5 w-5 text-accent" />
                  <h2 className="text-xl font-semibold">Мои наборы</h2>
                </div>
                <Button variant="outline" asChild>
                  <Link to={`/c/${courseId}/task-bank`}>
                    <Plus className="h-4 w-4" />
                    Собрать свой
                  </Link>
                </Button>
              </div>
              {sets.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sets.map((s) => (
                    <Link key={s.id} to={`/c/${courseId}/trainer/${s.id}`}>
                      <Card className="p-5 transition-shadow hover:shadow-elegant">
                        <h3 className="font-semibold">{s.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {s.item_count} задач · {s.source_title}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Нужна дополнительная практика? Соберите задачи под свою цель в
                  банке.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}
