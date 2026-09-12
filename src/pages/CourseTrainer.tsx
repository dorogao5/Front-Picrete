import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Play, ArrowRight } from "lucide-react";
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
      trainer?.source === "studio_fizicheskaya_himiya" &&
      trainer.generation_unlock?.[section.id] !== true
    ) return;
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
                const physicalGeneration = trainer.source === "studio_fizicheskaya_himiya";
                const generationLocked = physicalGeneration && trainer.generation_unlock?.[s.id] !== true;
                return (
                  <Card key={s.id} id={`section-${s.id}`} className="scroll-mt-24 p-5 sm:p-6">
                    <div className="flex gap-4">
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
                        <h2 className="text-xl font-semibold">{s.title}</h2>
                        <div
                          className="my-4 flex flex-wrap gap-2"
                          role="group"
                          aria-label={`Сложность: ${s.title}`}
                        >
                          {levels.map((l) => (
                            <Button
                              key={l.id}
                              size="sm"
                              variant={level === l.id ? "accent" : "outline"}
                              disabled={!available.includes(l) && !(physicalGeneration && !generationLocked)}
                              aria-pressed={level === l.id}
                              onClick={() =>
                                setChosen({ ...chosen, [s.id]: l.id })
                              }
                            >
                              {l.label}
                            </Button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="text-sm text-muted-foreground">
                            <p>
                              {physicalGeneration && count === 0
                                ? "В банке пока нет задач этого уровня — сгенерируйте новый набор"
                                : `${done} из ${goal} задач · в банке ${count}`}
                            </p>
                            {!!p?.solved && (
                              <p className="mt-1">
                                Без вопросов помощнику: {p.independent}.
                                Остальные — с помощью.
                              </p>
                            )}
                          </div>
                          <Button
                            disabled={!!busy || !count}
                            onClick={() => start(s.id, level)}
                          >
                            {busy === s.id
                              ? "Открываем…"
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
                              <span tabIndex={generationLocked ? 0 : undefined}>
                                <Button
                                  variant="outline"
                                  disabled={!!busy || !trainer.source || generationLocked}
                                  onClick={() => void generateMore(s, level)}
                                >
                                  {busy === `generate:${s.id}`
                                    ? "Формируем…"
                                    : physicalGeneration
                                      ? "Генерировать"
                                      : done === goal
                                        ? "Новый набор задач"
                                        : "Сформировать набор"}
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {generationLocked && <TooltipContent>решите 3 задачи</TooltipContent>}
                          </Tooltip>
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
