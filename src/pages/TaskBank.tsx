import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Dumbbell, SearchX, Sparkles } from "lucide-react";
import { toast } from "sonner";

import AuthImage from "@/components/AuthImage";
import ImageLightbox from "@/components/ImageLightbox";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader, PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchImageAsBlobUrl, getApiErrorMessage, taskBankAPI, trainerAPI } from "@/lib/api";
import type { TaskBankItem, TaskBankSource, TrainerSet } from "@/lib/api";
import { renderLatex, renderTaskText } from "@/lib/renderLatex";

const PAGE_SIZE = 40;

const selectClass =
  "mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TaskBank = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [sources, setSources] = useState<TaskBankSource[]>([]);
  const [items, setItems] = useState<TaskBankItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);

  const [sourceFilter, setSourceFilter] = useState("sviridov");
  const [paragraphFilter, setParagraphFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [hasAnswerFilter, setHasAnswerFilter] = useState<"all" | "yes" | "no">("all");
  const [generateCount, setGenerateCount] = useState(10);
  const [setTitle, setSetTitle] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, string>>({});

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!courseId) {
      return;
    }
    const fetchSources = async () => {
      try {
        const response = await taskBankAPI.sources(courseId);
        const nextSources = (response.data ?? []) as TaskBankSource[];
        setSources(nextSources);
        if (nextSources.length > 0 && !nextSources.some((source) => source.code === sourceFilter)) {
          setSourceFilter(nextSources[0].code);
        }
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Ошибка загрузки источников банка задач"));
      }
    };
    fetchSources();
  }, [courseId, sourceFilter]);

  useEffect(() => {
    if (!courseId) {
      return;
    }
    const fetchItems = async () => {
      setLoading(true);
      try {
        const response = await taskBankAPI.listItems(courseId, {
          source: sourceFilter,
          paragraph: paragraphFilter || undefined,
          topic: topicFilter || undefined,
          has_answer:
            hasAnswerFilter === "all" ? undefined : hasAnswerFilter === "yes",
          skip,
          limit: PAGE_SIZE,
        });
        setItems((response.data.items ?? []) as TaskBankItem[]);
        setTotalCount(response.data.total_count ?? 0);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Ошибка загрузки задач"));
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [courseId, sourceFilter, paragraphFilter, topicFilter, hasAnswerFilter, skip]);

  const selectedNumbers = useMemo(() => Object.values(selectedItems), [selectedItems]);

  const toggleSelection = (item: TaskBankItem) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = item.number;
      }
      return next;
    });
  };

  const createGeneratedSet = async () => {
    if (!courseId) {
      return;
    }
    try {
      const response = await trainerAPI.generateSet(
        {
          source: sourceFilter,
          filters: {
            paragraph: paragraphFilter || undefined,
            topic: topicFilter || undefined,
            has_answer:
              hasAnswerFilter === "all" ? undefined : hasAnswerFilter === "yes",
          },
          count: generateCount,
          title: setTitle || undefined,
        },
        courseId
      );
      const trainerSet = response.data as TrainerSet;
      toast.success("Тренировочный набор создан");
      navigate(`/c/${courseId}/trainer/${trainerSet.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка создания набора"));
    }
  };

  const createManualSet = async () => {
    if (!courseId) {
      return;
    }
    if (selectedNumbers.length === 0) {
      toast.error("Выберите хотя бы одну задачу");
      return;
    }
    try {
      const response = await trainerAPI.createManualSet(
        {
          source: sourceFilter,
          numbers: selectedNumbers,
          title: setTitle || undefined,
        },
        courseId
      );
      const trainerSet = response.data as TrainerSet;
      toast.success("Набор из выбранных задач создан");
      navigate(`/c/${courseId}/trainer/${trainerSet.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка создания ручного набора"));
    }
  };

  const openLightbox = async (item: TaskBankItem, index: number) => {
    const urls = item.images.map((image) => image.full_url);
    try {
      const blobUrls = await Promise.all(urls.map((url) => fetchImageAsBlobUrl(url)));
      setLightboxImages(blobUrls);
      setLightboxIndex(index);
      setLightboxOpen(true);
    } catch {
      toast.error("Не удалось загрузить изображения");
    }
  };

  const closeLightbox = () => {
    setLightboxImages((prev) => {
      prev.forEach((u) => u.startsWith("blob:") && URL.revokeObjectURL(u));
      return [];
    });
    setLightboxOpen(false);
  };

  if (!courseId) {
    return null;
  }

  return (
    <PageShell
      title="Банк задач"
      subtitle="Фильтруйте задачи и собирайте тренировочные наборы"
      actions={
        <Link to={`/c/${courseId}/trainer`}>
          <Button variant="outline" className="gap-1.5">
            <Dumbbell className="h-4 w-4" />
            Мои тренажёры
          </Button>
        </Link>
      }
    >
      <Card className="mb-6 p-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <Label htmlFor="source">Источник</Label>
            <select
              id="source"
              className={selectClass}
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setSkip(0);
              }}
            >
              {sources.map((source) => (
                <option key={source.id} value={source.code}>
                  {source.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="paragraph">Параграф</Label>
            <Input
              id="paragraph"
              className="mt-1"
              value={paragraphFilter}
              onChange={(event) => {
                setParagraphFilter(event.target.value);
                setSkip(0);
              }}
              placeholder="Например: 7"
            />
          </div>
          <div>
            <Label htmlFor="topic">Тема</Label>
            <Input
              id="topic"
              className="mt-1"
              value={topicFilter}
              onChange={(event) => {
                setTopicFilter(event.target.value);
                setSkip(0);
              }}
              placeholder="Поиск по теме"
            />
          </div>
          <div>
            <Label htmlFor="answer">Наличие ответа</Label>
            <select
              id="answer"
              className={selectClass}
              value={hasAnswerFilter}
              onChange={(event) => {
                setHasAnswerFilter(event.target.value as "all" | "yes" | "no");
                setSkip(0);
              }}
            >
              <option value="all">Все</option>
              <option value="yes">С ответом</option>
              <option value="no">Без ответа</option>
            </select>
          </div>
          <div>
            <Label htmlFor="count">Задач в подборке</Label>
            <Input
              id="count"
              className="mt-1"
              type="number"
              min={1}
              max={100}
              value={generateCount}
              onChange={(event) => setGenerateCount(Math.max(1, Number(event.target.value) || 1))}
            />
            <p className="mt-1 text-xs text-muted-foreground">Для автоматической подборки</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="set-title">Название набора</Label>
            <Input
              id="set-title"
              className="mt-1"
              value={setTitle}
              onChange={(event) => setSetTitle(event.target.value)}
              placeholder="Необязательно — придумаем сами"
            />
          </div>
          <div className="flex flex-wrap items-end justify-end gap-2">
            <Button variant="outline" className="gap-1.5" onClick={createGeneratedSet}>
              <Sparkles className="h-4 w-4" />
              Сгенерировать набор
            </Button>
            <Button variant="accent" onClick={createManualSet}>
              Создать из выбранных ({selectedNumbers.length})
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-3 text-sm text-muted-foreground">
        Найдено задач: {totalCount} · на странице: {items.length}
      </div>

      {loading ? (
        <PageLoader label="Загружаем задачи..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="По этим фильтрам задач нет"
          description="Попробуйте изменить источник, параграф или тему поиска."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 transition-shadow hover:shadow-elegant">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.number}</Badge>
                    <Badge variant="outline">§ {item.paragraph}</Badge>
                    {item.has_answer ? (
                      <Badge variant="success">С ответом</Badge>
                    ) : (
                      <Badge variant="muted">Без ответа</Badge>
                    )}
                  </div>
                  <h3 className="mb-2 font-semibold">{renderLatex(item.topic)}</h3>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {renderTaskText(item.text)}
                  </div>
                  {item.images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.images.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => openLightbox(item, index)}
                          className="overflow-hidden rounded-md border transition-shadow hover:shadow-soft"
                        >
                          <AuthImage
                            src={image.thumbnail_url}
                            alt={`Задача ${item.number}`}
                            className="h-20 w-20 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant={selectedItems[item.id] ? "default" : "outline"}
                  onClick={() => toggleSelection(item)}
                >
                  {selectedItems[item.id] ? "Выбрано" : "Выбрать"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={skip === 0}
          onClick={() => setSkip((prev) => Math.max(0, prev - PAGE_SIZE))}
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        <span className="text-sm text-muted-foreground">
          Страница {Math.floor(skip / PAGE_SIZE) + 1}
        </span>
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={skip + PAGE_SIZE >= totalCount}
          onClick={() => setSkip((prev) => prev + PAGE_SIZE)}
        >
          Вперёд
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </PageShell>
  );
};

export default TaskBank;
