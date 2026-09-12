import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Play, ArrowRight, LockKeyhole, LoaderCircle } from "lucide-react";
import { PageShell, PageLoader } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InlineError } from "@/components/InlineError";
import { getApiErrorMessage, trainerAPI } from "@/lib/api";
import { practice, levels, completion, type Trainer } from "@/lib/practice";
export default function CourseTrainer() {
  const { courseId = "", trainerId = "" } = useParams();
  const navigate = useNavigate();
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const generationPending = useRef(false);
  const load = useCallback(async () => {
    try {
      setError("");
      setTrainer(await practice.trainer(courseId, trainerId));
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить тему"));
    }
  }, [courseId, trainerId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (trainer && window.location.hash.startsWith("#section-")) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
    }
  }, [trainer]);
  async function start(section: string, level: string) {
    setBusy(section);
    setError("");
    try {
      const id = await practice.start(courseId, {
        trainer_id: trainerId,
        section_id: section,
        difficulty: level,
      });
      navigate(`/c/${courseId}/trainer/practice/${id}`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось открыть задачу"));
    } finally {
      setBusy("");
    }
  }
  async function generateMore(section: { id: string; title: string }, level: string) {
    if (busy || generationPending.current) return;
    if (
      (trainer?.studio_generation === true || trainer?.source === "studio_fizicheskaya_himiya") &&
      trainer.generation_unlock?.[section.id] !== true
    ) return;
    const levels = trainer?.generation_levels?.[section.id];
    if (levels !== undefined && !levels.includes(level)) return;
    if (!trainer?.source) {
      setError("Для этой подтемы не определён источник задач");
      return;
    }
    generationPending.current = true;
    setBusy(`generate:${section.id}`);
    setError("");
    try {
      const request = {
        trainer_id: trainerId,
        section_id: section.id,
        source: trainer.source,
        count: 5,
        title: `${section.title} · новый набор`,
        filters: {
          topic: section.title,
          difficulty: level,
          has_solution: true,
          has_answer: true,
        },
      };
      const response = await trainerAPI.generateSet(request, courseId);
      navigate(`/c/${courseId}/trainer/${response.data.id}`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось сформировать новый набор задач"));
    } finally {
      generationPending.current = false;
      setBusy("");
    }
  }
  const total = trainer ? completion(trainer) : null;
  return (
    <PageShell
      title={trainer?.definition.title}
      subtitle={trainer?.definition.description}
      backLabel="Все тренажёры"
      onBack={() => navigate(`/c/${courseId}/trainer`)}
    >
      {error && (
        <InlineError
          title="Не удалось выполнить действие"
          description={error}
          onRetry={load}
        />
      )}
      {!trainer && !error ? (
        <PageLoader />
      ) : (
        trainer && (
          <>
            <Card className="mb-8 flex flex-wrap items-center justify-between gap-5 bg-foreground p-6 text-background">
              <div>
                <p className="mb-1 text-sm opacity-70">Основная практика</p>
                <p className="text-2xl font-semibold">
                  {total?.done} из {total?.target} задач
                </p>
                <p className="mt-2 text-sm opacity-70">
                  Подтемы можно проходить по порядку или выбирать
                  самостоятельно.
                </p>
              </div>
              <span className="text-4xl font-semibold tabular-nums">
                {total?.percent}%
              </span>
            </Card>
            {!!busy && (
              <p role="status" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                {busy.startsWith("generate:")
                  ? "Формируем новый набор. Дождитесь завершения — повторно нажимать кнопку не нужно."
                  : "Открываем задачу…"}
              </p>
            )}
            <div className="space-y-4">
              {trainer.definition.sections.map((s, index) => {
                const available = levels.filter((l) =>
                  s.items.some((i) => i.difficulty === l.id),
                );
                const level = chosen[s.id] ?? available[0]?.id ?? "easy";
                const count = s.items.filter(
                  (i) => i.difficulty === level,
                ).length;
                const goal = Math.min(s.target, count);
                const p = trainer.progress.find(
                  (p) => p.section_id === s.id && p.difficulty === level,
                );
                const done = Math.min(goal, p?.solved ?? 0);
                const physicalGeneration = trainer.studio_generation === true || trainer.source === "studio_fizicheskaya_himiya";
                const generationLevels = trainer.generation_levels?.[s.id];
                const noBlueprint = generationLevels !== undefined && !generationLevels.includes(level);
                const generationLocked = physicalGeneration && (trainer.generation_unlock?.[s.id] !== true || noBlueprint);
                const unlockProgress = trainer.generation_progress?.[s.id];
                const required = unlockProgress?.required ?? 3;
                const generationHintId = `generation-hint-${s.id}`;
                const bankHintId = `bank-hint-${s.id}`;
                const generationHint = !trainer.source
                  ? "Генерация недоступна: для тренажёра не настроен источник задач. Обратитесь к преподавателю."
                  : noBlueprint
                    ? "Для этого уровня пока нет блюпринта. Выберите доступный уровень."
                  : generationLocked
                    ? `Решите ${required} разные задачи из банка этой подтемы чтобы генерировать новые задачи. Подойдёт любой уровень сложности.`
                    : "Можно генерировать новые задачи выбранного уровня и продолжать практику.";
                return (
                  <Card key={s.id} id={`section-${s.id}`} className="scroll-mt-24 p-5 sm:p-6">
                    <div className="flex gap-3 sm:gap-4">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done === goal && goal ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}
                      >
                        {done === goal && goal ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold leading-snug sm:text-xl">{s.title}</h2>
                        <p className="mt-4 text-xs font-medium text-muted-foreground">Уровень задач</p>
                        <div
                          className="mb-4 mt-2 flex flex-wrap gap-2"
                          role="group"
                          aria-label={`Сложность: ${s.title}`}
                        >
                          {levels.map((l) => (
                            <Button
                              key={l.id}
                              size="sm"
                              variant={level === l.id ? "accent" : "outline"}
                              disabled={!available.includes(l) && (!physicalGeneration || (generationLevels !== undefined && !generationLevels.includes(l.id)))}
                              aria-pressed={level === l.id}
                              title={`Готовых задач: ${s.items.filter((item) => item.difficulty === l.id).length}`}
                              onClick={() =>
                                setChosen((current) => ({ ...current, [s.id]: l.id }))
                              }
                            >
                              {l.label}
                            </Button>
                          ))}
                        </div>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0 text-sm text-muted-foreground">
                            <p id={bankHintId} aria-live="polite">
                              {physicalGeneration && count === 0
                                ? generationLocked
                                  ? available.length
                                    ? "Готовых задач этого уровня пока нет. Для начала выберите другой уровень."
                                    : "В этой подтеме пока нет готовых задач. Преподавателю нужно добавить их в банк."
                                  : "Готовых задач этого уровня пока нет — можно сгенерировать новый набор."
                                : `Решено ${done} из ${goal} · готовых задач в банке: ${count}`}
                            </p>
                            {!!p?.solved && (
                              <p className="mt-1">
                                Без вопросов помощнику: {p.independent}.
                                Остальные — с помощью.
                              </p>
                            )}
                          </div>
                          <div className="grid shrink-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                          <Button
                            className="flex-1 sm:flex-none"
                            disabled={!!busy || !count}
                            aria-describedby={!count ? bankHintId : undefined}
                            onClick={() => start(s.id, level)}
                          >
                            {busy === s.id
                              ? "Открываем…"
                              : goal > 0 && done >= goal
                                ? "Решать ещё"
                                : done
                                ? "Продолжить"
                                : "Начать"}
                            {done ? (
                              <ArrowRight className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
                                tabIndex={generationLocked || !trainer.source ? 0 : undefined}
                                role={generationLocked || !trainer.source ? "group" : undefined}
                                aria-label={generationLocked || !trainer.source ? "Генерация недоступна" : undefined}
                                aria-describedby={generationHintId}
                              >
                                <Button
                                  className="w-full"
                                  variant="outline"
                                  disabled={!!busy || !trainer.source || generationLocked}
                                  aria-describedby={generationHintId}
                                  onClick={() => void generateMore(s, level)}
                                >
                                  {busy === `generate:${s.id}`
                                    ? "Формируем…"
                                    : physicalGeneration
                                      ? "Генерировать"
                                      : done === goal
                                        ? "Новый набор задач"
                                        : "Сформировать набор"}
                                  {busy === `generate:${s.id}`
                                    ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                                    : generationLocked
                                      ? <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                                      : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {(generationLocked || !trainer.source) && <TooltipContent className="max-w-xs">{generationHint}</TooltipContent>}
                          </Tooltip>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-start sm:justify-between">
                          <p id={generationHintId} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                            {generationLocked && <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
                            {generationHint}
                          </p>
                          {generationLocked && unlockProgress && (
                            <span className="shrink-0 self-start rounded-full bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums">
                              {`Решено ${Math.min(required, unlockProgress.solved)} из ${required}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )
      )}
    </PageShell>
  );
}
