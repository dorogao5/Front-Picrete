import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send,
  Paperclip,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Loader2,
  BookOpen,
  Save,
} from "lucide-react";
import { PageShell, PageLoader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import MathEditor from "@/components/MathEditor";
import { RichText } from "@/components/RichText";
import AuthImage from "@/components/AuthImage";
import { InlineError } from "@/components/InlineError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getApiErrorMessage, materialsAPI } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { practice, type Attempt } from "@/lib/practice";
export default function PracticeAttempt() {
  const { courseId, attemptId } = useParams();
  return <PracticeAttemptContent key={`${courseId}:${attemptId}`} />;
}

function PracticeAttemptContent() {
  const { courseId = "", attemptId = "" } = useParams();
  const navigate = useNavigate();
  const cacheKey = `practice-draft:${getUser()?.id}:${courseId}:${attemptId}`;
  const [mobilePane, setMobilePane] = useState<"work" | "chat">("work");
  const [a, setA] = useState<Attempt | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [saved, setSaved] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const load = useCallback(async () => {
    try {
      const next = await practice.get(courseId, attemptId);
      setA(next);
      if (!dirty.current) {
        let cached: { draft: string; revision: number } | null = null;
        try {
          cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
        } catch {
          /* Ignore damaged tab-local cache. */
        }
        if (
          cached &&
          cached.revision === next.revision &&
          typeof cached.draft === "string" &&
          cached.draft !== next.draft
        ) {
          setDraft(cached.draft);
          dirty.current = true;
        } else setDraft(next.draft);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить попытку"));
    }
  }, [courseId, attemptId, cacheKey]);
  useEffect(() => {
    dirty.current = false;
    setA(null);
    setDraft("");
    setMessage("");
    setError("");
    setSaved(false);
    void load();
  }, [load]);
  const pending =
    a?.jobs.some((j) => j.status === "queued" || j.status === "running") ??
    false;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void load(), 1800);
    return () => clearInterval(timer);
  }, [pending, load]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [a?.messages.length]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  async function persist() {
    if (!a) return 0;
    if (!dirty.current) return a.revision;
    const r = await practice.edit(courseId, a, draft);
    dirty.current = false;
    setA((current) =>
      current ? { ...current, revision: r.revision, draft } : current,
    );
    setSaved(true);
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      /* no-op */
    }
    return r.revision;
  }
  async function act(kind: string, text = "") {
    if (!a) return;
    setBusy(true);
    setError("");
    try {
      const revision = await persist();
      await practice.action(courseId, a.id, revision, kind, text);
      if (kind === "message") setMessage("");
      if (kind === "message" || kind === "check" || kind === "reveal")
        setMobilePane("chat");
      setReveal(false);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось выполнить действие"));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      await persist();
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось сохранить черновик"));
    } finally {
      setBusy(false);
    }
  }
  async function upload(f?: File) {
    if (!a || !f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Фото должно быть не больше 10 МБ");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await persist();
      await practice.upload(courseId, a.id, f);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить фото"));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function openMaterials() {
    try {
      await materialsAPI.openAdditionPdf(courseId);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось открыть справочник"));
    }
  }
  async function next() {
    if (!a) return;
    setBusy(true);
    setError("");
    try {
      await persist();
      const id = await practice.start(courseId, {
        ...(a.trainer_id
          ? {
              trainer_id: a.trainer_id,
              section_id: a.section_id!,
              difficulty: a.difficulty,
            }
          : { set_id: a.set_id! }),
        preview: a.preview,
        next: true,
      });
      navigate(`/c/${courseId}/trainer/practice/${id}`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось выбрать следующую задачу"));
    } finally {
      setBusy(false);
    }
  }
  async function back() {
    if (dirty.current) {
      setBusy(true);
      try {
        await persist();
      } catch (e) {
        setError(getApiErrorMessage(e, "Не удалось сохранить черновик"));
        setBusy(false);
        return;
      }
    }
    navigate(
      a?.trainer_id
        ? `/c/${courseId}/trainer/${a.preview ? "manage" : "course"}/${a.trainer_id}`
        : a?.set_id
          ? `/c/${courseId}/trainer/${a.set_id}`
          : `/c/${courseId}/trainer`,
    );
  }
  const locked = busy || pending;
  const last = a?.checks.at(-1);
  const failed = a?.jobs[0]?.status === "failed" ? a.jobs[0] : null;
  return (
    <PageShell
      width="wide"
      title={a?.title}
      backLabel={a?.preview ? "Вернуться к редактору" : "К задачам"}
      onBack={back}
      actions={
        a && (
          <>
            <Button variant="outline" onClick={openMaterials}>
              <BookOpen className="h-4 w-4" />
              Справочник
            </Button>
            <Button variant="outline" disabled={locked} onClick={next}>
              Другая задача
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )
      }
    >
      {error && (
        <div className="mb-4">
          <InlineError
            title="Не удалось выполнить действие"
            description={error}
            onRetry={load}
          />
        </div>
      )}
      {!a ? (
        !error && <PageLoader />
      ) : (
        <>
          {a.preview && (
            <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
              Предпросмотр преподавателя · те же подсказки и проверка, без
              записи в прогресс студента.
            </div>
          )}
          <div
            className="mb-4 grid grid-cols-2 gap-1 rounded-lg border bg-card p-1 xl:hidden"
            role="group"
            aria-label="Рабочая область"
          >
            <Button
              variant={mobilePane === "work" ? "default" : "ghost"}
              aria-pressed={mobilePane === "work"}
              onClick={() => setMobilePane("work")}
            >
              Задача и решение
            </Button>
            <Button
              variant={mobilePane === "chat" ? "default" : "ghost"}
              aria-pressed={mobilePane === "chat"}
              onClick={() => setMobilePane("chat")}
            >
              Помощник {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            </Button>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)]">
            <div
              className={
                mobilePane === "work"
                  ? "space-y-5"
                  : "hidden space-y-5 xl:block"
              }
            >
              <Card className="p-5 sm:p-7">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                    Задача № {a.task.number}
                  </span>
                  {a.solved && (
                    <span className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Решение проверено
                    </span>
                  )}
                </div>
                <RichText className="text-base leading-relaxed">
                  {a.task.text}
                </RichText>
                {a.task.images.map((i) => (
                  <AuthImage
                    key={i.id}
                    src={i.full_url}
                    alt="Иллюстрация к условию"
                    className="mt-4 max-h-80 max-w-full object-contain"
                  />
                ))}
              </Card>
              <Card className="p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Моё решение</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked || !dirty.current}
                    onClick={save}
                  >
                    <Save className="h-4 w-4" />
                    {saved && !dirty.current ? "Сохранено" : "Сохранить"}
                  </Button>
                </div>
                <MathEditor key={cacheKey}
                  label="Черновик решения"
                  value={draft}
                  onChange={(text) => {
                    setDraft(text);
                    dirty.current = true;
                    try {
                      sessionStorage.setItem(
                        cacheKey,
                        JSON.stringify({
                          draft: text,
                          revision: a.revision,
                        }),
                      );
                    } catch {
                      /* Server save remains available. */
                    }
                    setSaved(false);
                  }}
                  disabled={locked}
                  maxLength={60000}
                  hint="Запишите ход решения или загрузите фото. Можно начать с любого шага — помощник рядом."
                  className="min-h-52 resize-y text-base leading-relaxed"
                />
                {a.photos.length > 0 && (
                  <div className="my-4 flex flex-wrap gap-3">
                    {a.photos.map((p) => (
                      <a
                        key={p.id}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        title={p.filename}
                      >
                        <img
                          src={p.url}
                          alt={p.filename}
                          className="h-20 w-20 rounded-lg border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <input
                    ref={file}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    aria-label="Загрузить фото решения"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  <Button
                    variant="outline"
                    disabled={locked || a.photos.length >= 10}
                    onClick={() => file.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    Добавить фото
                  </Button>
                  <Button
                    variant="accent"
                    disabled={locked || !draft.trim() || !a.can_check}
                    onClick={() => act("check")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Проверить решение
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Фото добавится в черновик после распознавания. Проверьте
                  формулы перед проверкой.
                </p>
                {!a.can_check && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    У этой задачи ещё нет полного эталона. Можно обсуждать
                    решение с помощником.
                  </p>
                )}
              </Card>
              {last && (
                <Card className="p-5">
                  <h2 className="mb-3 text-lg font-semibold">
                    Последняя проверка
                  </h2>
                  {last.unreadable ? (
                    <p>
                      Не удалось уверенно прочитать решение. Уточните запись в
                      черновике.
                    </p>
                  ) : (
                    <>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {last.total_score} из {last.max_score} · результат
                        проверенной версии черновика
                      </p>
                      <div className="space-y-3">
                        {last.criteria_scores?.map((c) => (
                          <div key={c.criterion_name} className="border-t pt-3">
                            <div className="flex justify-between gap-3 text-sm font-medium">
                              <span>{c.criterion_name}</span>
                              <span>
                                {c.score}/{c.max_score}
                              </span>
                            </div>
                            <RichText className="mt-1 text-sm text-muted-foreground">
                              {c.comment}
                            </RichText>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              )}
            </div>
            <Card
              className={`${mobilePane === "chat" ? "flex" : "hidden xl:flex"} min-h-[580px] flex-col overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)]`}
            >
              <div className="border-b bg-accent/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  Разбор с помощником
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {a.can_chat !== false
                    ? "Можно спросить ещё до первого шага решения."
                    : "Помощник курса ещё не настроен. Вы можете решать самостоятельно и открывать ответы."}
                </p>
              </div>
              <div
                className="flex-1 space-y-5 overflow-y-auto p-5"
                aria-live="polite"
              >
                {!a.messages.length && (
                  <div className="py-7">
                    <p className="mb-5 text-base leading-relaxed">
                      С чего начнём? Пришлите свой шаг или расскажите, что
                      вызывает затруднение.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "С чего начать?",
                        "Объясни, какие понятия здесь нужны",
                      ].map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          className="h-auto whitespace-normal py-2 text-left"
                          disabled={locked || a.can_chat === false}
                          onClick={() => act("message", q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {a.messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "ml-6 rounded-xl bg-accent/10 p-4"
                        : "mr-2"
                    }
                  >
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      {m.role === "user"
                        ? "Вы"
                        : m.kind === "check"
                          ? "Проверка решения"
                          : "Помощник"}
                    </p>
                    <RichText className="text-base leading-relaxed">
                      {m.content}
                    </RichText>
                  </div>
                ))}
                {pending && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {a.jobs.find((j) =>
                      ["queued", "running"].includes(j.status),
                    )?.kind === "ocr"
                      ? "Распознаём фото…"
                      : "Помощник работает…"}{" "}
                    Можно вернуться позже.
                  </p>
                )}
                {failed && (
                  <div
                    role="alert"
                    className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
                  >
                    {failed.error}
                    <Button
                      className="mt-2"
                      variant="outline"
                      size="sm"
                      disabled={locked}
                      onClick={() => act("retry", failed.id)}
                    >
                      Повторить обработку
                    </Button>
                  </div>
                )}
                <div ref={end} />
              </div>
              <form
                className="space-y-3 border-t bg-card p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("message", message);
                }}
              >
                <MathEditor
                  label="Вопрос помощнику"
                  hint="Спросите о задаче или своём решении…"
                  maxLength={6000}
                  value={message}
                  disabled={locked}
                  onChange={setMessage}
                />
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={locked}
                    onClick={() => setReveal(true)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Открыть разбор
                  </Button>
                  <Button
                    type="submit"
                    disabled={locked || a.can_chat === false || !message.trim()}
                  >
                    <Send className="h-4 w-4" />
                    Отправить
                  </Button>
                </div>
              </form>
            </Card>
          </div>
          <Dialog open={reveal} onOpenChange={setReveal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Показать полный разбор?</DialogTitle>
                <DialogDescription>
                  Это поможет разобраться в методе. Просмотр не засчитывается
                  как самостоятельное решение. После разбора можно попробовать
                  другую задачу.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReveal(false)}>
                  Продолжить самому
                </Button>
                <Button disabled={locked} onClick={() => act("reveal")}>
                  Показать разбор
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </PageShell>
  );
}
