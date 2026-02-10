import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ImageLightbox from "@/components/ImageLightbox";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage, taskBankAPI, trainerAPI } from "@/lib/api";
import type { TaskBankItem, TaskBankSource, TrainerSet } from "@/lib/api";
import { renderLatex } from "@/lib/renderLatex";
import { toast } from "sonner";

const PAGE_SIZE = 40;

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
      toast.success("Ручной набор создан");
      navigate(`/c/${courseId}/trainer/${trainerSet.id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка создания ручного набора"));
    }
  };

  const openLightbox = (item: TaskBankItem, index: number) => {
    const images = item.images.map((image) => image.full_url);
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
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
            <h1 className="text-4xl font-bold mb-2">Банк задач</h1>
            <p className="text-muted-foreground">Фильтрация задач и создание тренажерных наборов</p>
          </div>
          <Link to={`/c/${courseId}/trainer`}>
            <Button variant="outline">Мои тренажеры</Button>
          </Link>
        </div>

        <Card className="p-6 mb-6">
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="source">Источник</Label>
              <select
                id="source"
                className="w-full border rounded-md p-2"
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
                className="w-full border rounded-md p-2"
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
              <Label htmlFor="count">Количество в генерации</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={generateCount}
                onChange={(event) => setGenerateCount(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <Input
              value={setTitle}
              onChange={(event) => setSetTitle(event.target.value)}
              placeholder="Название набора (необязательно)"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={createGeneratedSet}>
                Сгенерировать набор
              </Button>
              <Button onClick={createManualSet}>
                Создать ручной набор ({selectedNumbers.length})
              </Button>
            </div>
          </div>
        </Card>

        <div className="mb-3 text-sm text-muted-foreground">
          Найдено: {totalCount} задач. Показано: {items.length}.
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Загрузка...</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="secondary">{item.number}</Badge>
                      <Badge variant="outline">§ {item.paragraph}</Badge>
                      {item.has_answer ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          С ответом
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                          Без ответа
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold mb-2">{item.topic}</h3>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {renderLatex(item.text)}
                    </div>
                    {item.images.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.images.map((image, index) => (
                          <button
                            key={image.id}
                            type="button"
                            onClick={() => openLightbox(item, index)}
                            className="border rounded overflow-hidden"
                          >
                            <img
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
            disabled={skip === 0}
            onClick={() => setSkip((prev) => Math.max(0, prev - PAGE_SIZE))}
          >
            Предыдущая страница
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {Math.floor(skip / PAGE_SIZE) + 1}
          </span>
          <Button
            variant="outline"
            disabled={skip + PAGE_SIZE >= totalCount}
            onClick={() => setSkip((prev) => prev + PAGE_SIZE)}
          >
            Следующая страница
          </Button>
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default TaskBank;
