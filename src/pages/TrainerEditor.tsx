import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  Check,
  Eye,
  Save,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageLoader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichText } from "@/components/RichText";
import { InlineError } from "@/components/InlineError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  practice,
  levels,
  type Definition,
  type Trainer,
  type Section,
} from "@/lib/practice";
import { getApiErrorMessage, taskBankAPI, type TaskBankItem } from "@/lib/api";
import { getUser } from "@/lib/auth";
const blank = (): Definition => ({ title: "", description: "", sections: [] });
export default function TrainerEditor() {
  const { courseId = "", trainerId = "new" } = useParams();
  const navigate = useNavigate();
  const cacheKey = `trainer-draft:${getUser()?.id}:${courseId}:${trainerId}`;
  function cached(): { definition: Definition; revision?: number } | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      return value &&
        Array.isArray(value.definition?.sections) &&
        typeof value.definition?.title === "string"
        ? value
        : null;
    } catch {
      return null;
    }
  }
  const [data, setData] = useState<Definition>(
    () => cached()?.definition ?? blank(),
  );
  const [record, setRecord] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(trainerId !== "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [bank, setBank] = useState<TaskBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [bankError, setBankError] = useState("");
  const load = useCallback(async () => {
    if (trainerId === "new") return;
    setLoading(true);
    try {
      const t = await practice.trainer(courseId, trainerId, true);
      setRecord(t);
      let restored: { definition: Definition; revision?: number } | null = null;
      try {
        restored = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      } catch {
        /* Ignore damaged tab-local cache. */
      }
      setData(
        restored?.revision === t.revision &&
          Array.isArray(restored?.definition?.sections)
          ? restored.definition
          : t.definition,
      );
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить тренажёр"));
    } finally {
      setLoading(false);
    }
  }, [courseId, trainerId, cacheKey]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!loading) {
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ definition: data, revision: record?.revision }),
        );
      } catch {
        /* Saving to the server remains available. */
      }
    }
  }, [data, record?.revision, loading, cacheKey]);
  useEffect(() => {
    if (!picker) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setBankError("");
      try {
        const r = await taskBankAPI.listItems(courseId, {
          q: query,
          has_solution: true,
          skip: page * 15,
          limit: 15,
        });
        if (!cancelled) {
          setBank(r.data.items);
          setTotal(r.data.total_count);
        }
      } catch (e) {
        if (!cancelled)
          setBankError(getApiErrorMessage(e, "Не удалось загрузить банк"));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [picker, query, page, courseId]);
  function patch(id: string, p: Partial<Section>) {
    setData((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)),
    }));
  }
  function move(index: number, delta: number) {
    setData((d) => {
      const sections = [...d.sections];
      [sections[index], sections[index + delta]] = [
        sections[index + delta],
        sections[index],
      ];
      return { ...d, sections };
    });
  }
  async function save(publish = false, preview?: string) {
    setBusy(true);
    setError("");
    try {
      const saved = await practice.save(
        courseId,
        record?.id ?? null,
        data,
        record?.revision,
      );
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {
        /* no-op */
      }
      const current = {
        id: saved.id,
        revision: saved.revision,
        definition: data,
      } as Trainer;
      setRecord({
        ...record,
        ...current,
        published: record?.published ?? false,
        progress: record?.progress ?? [],
        release_id: record?.release_id ?? null,
      });
      if (publish) {
        await practice.publish(courseId, current);
        toast.success("Тренажёр опубликован для студентов");
      }
      if (preview) {
        const section = data.sections.find((s) => s.id === preview)!;
        const id = await practice.start(courseId, {
          trainer_id: saved.id,
          section_id: preview,
          difficulty: section.items[0].difficulty,
          preview: true,
          next: true,
        });
        navigate(`/c/${courseId}/trainer/practice/${id}`);
        return;
      }
      navigate(`/c/${courseId}/trainer/manage/${saved.id}`, { replace: true });
      const t = await practice.trainer(courseId, saved.id, true);
      setRecord(t);
      if (!publish) toast.success("Черновик сохранён");
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось сохранить тренажёр"));
    } finally {
      setBusy(false);
    }
  }
  async function hide() {
    if (!record) return;
    setBusy(true);
    try {
      await practice.unpublish(courseId, record.id);
      await load();
      toast.success("Тренажёр скрыт из каталога");
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось снять публикацию"));
    } finally {
      setBusy(false);
    }
  }
  const section = data.sections.find((s) => s.id === picker);
  return (
    <PageShell
      title={trainerId === "new" ? "Новый тренажёр" : "Содержание тренажёра"}
      subtitle="Соберите тему один раз — каждый студент получит свои задачи, диалог и прогресс."
      backLabel="К тренажёрам"
      onBack={() => navigate(`/c/${courseId}/trainer`)}
      actions={
        <>
          <Button variant="outline" disabled={busy} onClick={() => save()}>
            <Save className="h-4 w-4" />
            Сохранить
          </Button>
          <Button
            variant="accent"
            disabled={busy || !data.sections.length}
            onClick={() => save(true)}
          >
            <Send className="h-4 w-4" />
            {record?.published ? "Опубликовать обновление" : "Опубликовать"}
          </Button>
        </>
      }
    >
      {loading ? (
        <PageLoader />
      ) : (
        <fieldset disabled={busy} className="min-w-0">
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
          >
            <span>
              {record?.published
                ? "Студенты видят опубликованную версию. Повторная публикация изменённого состава начнёт новый прогресс; история попыток сохранится."
                : "Черновик · виден только преподавателям курса"}
            </span>
            {record?.published && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={hide}>
                Скрыть из каталога
              </Button>
            )}
          </div>
          {error && (
            <InlineError
              title="Не удалось выполнить действие"
              description={error}
            />
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <Card className="space-y-4 p-6">
                <label className="block text-sm font-medium">
                  Название темы
                  <Input
                    className="mt-2"
                    maxLength={180}
                    placeholder="Например, Растворы"
                    value={data.title}
                    onChange={(e) =>
                      setData({ ...data, title: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-medium">
                  Что будем практиковать
                  <Textarea
                    className="mt-2"
                    maxLength={3000}
                    placeholder="Кратко опишите, чему посвящён тренажёр"
                    value={data.description}
                    onChange={(e) =>
                      setData({ ...data, description: e.target.value })
                    }
                  />
                </label>
              </Card>
              {data.sections.map((s, index) => (
                <Card key={s.id} className="p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="mr-2 text-sm font-semibold text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Input
                      aria-label={`Название подтемы ${index + 1}`}
                      placeholder="Название подтемы"
                      value={s.title}
                      onChange={(e) => patch(s.id, { title: e.target.value })}
                    />
                    <Button
                      aria-label="Выше"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Ниже"
                      size="icon"
                      variant="ghost"
                      disabled={index === data.sections.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="Удалить подтему"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setData({
                          ...data,
                          sections: data.sections.filter((x) => x.id !== s.id),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {levels.map((l) => (
                      <span
                        key={l.id}
                        className="rounded-full bg-muted px-3 py-1 text-sm"
                      >
                        {l.label}:{" "}
                        {s.items.filter((i) => i.difficulty === l.id).length}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <label className="text-sm">
                      Цель на уровень
                      <Input
                        className="mt-1 w-24"
                        type="number"
                        min={1}
                        max={30}
                        value={s.target}
                        onChange={(e) =>
                          patch(s.id, { target: Number(e.target.value) })
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPage(0);
                          setQuery("");
                          setPicker(s.id);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Выбрать задачи
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy || !s.items.length || !data.title.trim()}
                        onClick={() => save(false, s.id)}
                      >
                        <Eye className="h-4 w-4" />
                        Попробовать
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() =>
                  setData({
                    ...data,
                    sections: [
                      ...data.sections,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        target: 3,
                        items: [],
                      },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Добавить подтему
              </Button>
            </div>
            <aside className="rounded-xl bg-accent/5 p-5 text-sm leading-relaxed lg:sticky lg:top-24">
              <h2 className="mb-3 font-semibold">Понятный маршрут практики</h2>
              <p className="mb-3">
                Порядок подтем рекомендует маршрут. Студент сможет перейти к
                любой из них и выбрать сложность.
              </p>
              <p className="mb-3">
                Цель ограничивается числом доступных задач. Первый доступный
                уровень подтемы формирует общий прогресс; остальные доступны
                дополнительно.
              </p>
              <p className="text-muted-foreground">
                Перед публикацией попробуйте задачу как студент. Тестовые
                решения не попадут в прогресс или журнал работ.
              </p>
            </aside>
          </div>
          <Dialog
            open={!!picker}
            onOpenChange={(open) => {
              if (!open) setPicker(null);
            }}
          >
            <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Задачи · {section?.title || "Подтема"}
                </DialogTitle>
                <DialogDescription>
                  Отметьте задачи и назначьте уровень сложности для этой
                  подтемы.
                </DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Номер, тема или текст задачи"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Выбрано: {section?.items.length ?? 0}. Показаны задачи с полными
                эталонными решениями.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={searching || !bank.length}
                onClick={() => {
                  if (section)
                    patch(section.id, {
                      items: [
                        ...section.items,
                        ...bank
                          .filter(
                            (t) =>
                              !section.items.some((i) => i.task_id === t.id),
                          )
                          .map((t) => ({
                            task_id: t.id,
                            difficulty: levels.some(
                              (l) => l.id === t.difficulty,
                            )
                              ? t.difficulty!
                              : "easy",
                          })),
                      ],
                    });
                }}
              >
                Добавить все на странице
              </Button>
              {bankError && <InlineError description={bankError} />}
              {searching ? (
                <PageLoader label="Ищем задачи…" />
              ) : (
                <div className="space-y-3">
                  {bank.map((t) => {
                    const picked = section?.items.find(
                      (i) => i.task_id === t.id,
                    );
                    return (
                      <div
                        key={t.id}
                        className={`rounded-lg border p-4 ${picked ? "border-accent bg-accent/5" : ""}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            № {t.number}
                          </span>
                          <div className="flex gap-2">
                            {picked && (
                              <select
                                className="rounded border bg-background p-1 text-sm"
                                aria-label={`Сложность задачи ${t.number}`}
                                value={picked.difficulty}
                                onChange={(e) =>
                                  patch(section!.id, {
                                    items: section!.items.map((i) =>
                                      i.task_id === t.id
                                        ? { ...i, difficulty: e.target.value }
                                        : i,
                                    ),
                                  })
                                }
                              >
                                {levels.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            <Button
                              size="sm"
                              variant={picked ? "accent" : "outline"}
                              onClick={() =>
                                patch(section!.id, {
                                  items: picked
                                    ? section!.items.filter(
                                        (i) => i.task_id !== t.id,
                                      )
                                    : [
                                        ...section!.items,
                                        {
                                          task_id: t.id,
                                          difficulty: levels.some(
                                            (l) => l.id === t.difficulty,
                                          )
                                            ? t.difficulty!
                                            : "easy",
                                        },
                                      ],
                                })
                              }
                            >
                              {picked ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  Убрать
                                </>
                              ) : (
                                "Добавить"
                              )}
                            </Button>
                          </div>
                        </div>
                        <RichText className="text-sm">{t.text}</RichText>
                      </div>
                    );
                  })}
                  {!bank.length && (
                    <p className="py-8 text-center text-muted-foreground">
                      Задач по этому запросу нет.
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </Button>
                <span className="text-sm">Страница {page + 1}</span>
                <Button
                  variant="outline"
                  disabled={(page + 1) * 15 >= total}
                  onClick={() => setPage(page + 1)}
                >
                  Далее
                </Button>
                <Button onClick={() => setPicker(null)}>Готово</Button>
              </div>
            </DialogContent>
          </Dialog>
        </fieldset>
      )}
    </PageShell>
  );
}
