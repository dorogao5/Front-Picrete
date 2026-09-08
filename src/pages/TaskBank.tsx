import { MathCombobox } from "@/components/MathCombobox";
import { BankAdvancedFilters } from "@/components/BankAdvancedFilters";
import { bankFilterParams, emptyBankFilters } from "@/lib/bankFilters";
import { BankTaskBadges, BankTaskReference } from "@/components/BankTaskDetails";
import { getMembershipForCourse, isAdmin } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckSquare, ChevronLeft, ChevronRight, Dumbbell, FilterX, SearchX, Sparkles } from "lucide-react";
import { toast } from "sonner";

import AuthImage from "@/components/AuthImage";
import ImageLightbox from "@/components/ImageLightbox";
import { EmptyState } from "@/components/EmptyState";
import { InlineError } from "@/components/InlineError";
import { PageLoader, PageShell } from "@/components/PageShell";
import { RichText } from "@/components/RichText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchImageAsBlobUrl, getApiErrorMessage, taskBankAPI, trainerAPI } from "@/lib/api";
import type { TaskBankItem, TaskBankSource, TrainerSet } from "@/lib/api";

const MOBILE_PAGE_SIZE = 16;
const DESKTOP_PAGE_SIZE = 40;

const getPageSize = () =>
  typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
    ? MOBILE_PAGE_SIZE
    : DESKTOP_PAGE_SIZE;

const selectClass =
  "mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const TaskBank = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const teacherMode = isAdmin() || Boolean(courseId && getMembershipForCourse(courseId)?.roles.includes("teacher"));
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(emptyBankFilters);
  const [appliedAdvanced, setAppliedAdvanced] = useState(emptyBankFilters);
  useEffect(() => {
    const timer = window.setTimeout(() => { setAppliedAdvanced(advanced); setSkip(0); }, 350);
    return () => window.clearTimeout(timer);
  }, [advanced]);

  const [sources, setSources] = useState<TaskBankSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState("");
  const [sourcesRetry, setSourcesRetry] = useState(0);
  const [items, setItems] = useState<TaskBankItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [itemsRetry, setItemsRetry] = useState(0);
  const [skip, setSkip] = useState(0);
  const [pageSize, setPageSize] = useState(getPageSize);

  const [sourceFilter, setSourceFilter] = useState("");
  const [paragraphDraft, setParagraphDraft] = useState("");
  const [topicDraft, setTopicDraft] = useState("");
  const [paragraphFilter, setParagraphFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [hasAnswerFilter, setHasAnswerFilter] = useState<"all" | "yes" | "no">("all");
  const [generateCount, setGenerateCount] = useState(10);
  const [setTitle, setSetTitle] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, TaskBankItem>>({});
  const [creatingSet, setCreatingSet] = useState<"automatic" | "manual" | null>(null);
  const itemsRequestRef = useRef(0);

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const updatePageSize = () => {
      setPageSize(media.matches ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE);
      setSkip(0);
    };

    media.addEventListener("change", updatePageSize);
    return () => media.removeEventListener("change", updatePageSize);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParagraphFilter(paragraphDraft.trim());
      setTopicFilter(topicDraft.trim());
      setSkip(0);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [paragraphDraft, topicDraft]);

  useEffect(() => {
    if (!courseId) {
      return;
    }
    let cancelled = false;
    setSelectedItems({});
    const fetchSources = async () => {
      setSourcesLoading(true);
      setSourcesError("");
      try {
        const response = await taskBankAPI.sources(courseId);
        if (cancelled) return;
        const nextSources = (response.data ?? []) as TaskBankSource[];
        setSources(nextSources);
        setSourceFilter((current) =>
          nextSources.some((source) => source.code === current) ? current : nextSources[0]?.code ?? "",
        );
      } catch (error: unknown) {
        if (!cancelled) setSourcesError(getApiErrorMessage(error, "Не удалось загрузить источники банка задач"));
      } finally {
        if (!cancelled) setSourcesLoading(false);
      }
    };
    fetchSources();
    return () => { cancelled = true; };
  }, [courseId, sourcesRetry]);

  useEffect(() => {
    if (!courseId || sourcesLoading) {
      return;
    }
    if (!sourceFilter) {
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    const fetchItems = async () => {
      const requestId = ++itemsRequestRef.current;
      setLoading(true);
      setItemsError("");
      try {
        const response = await taskBankAPI.listItems(courseId, {
          ...bankFilterParams(appliedAdvanced),
          source: sourceFilter,
          paragraph: paragraphFilter || undefined,
          topic: topicFilter || undefined,
          has_answer:
            hasAnswerFilter === "all" ? undefined : hasAnswerFilter === "yes",
          skip,
          limit: pageSize,
        });
        if (requestId === itemsRequestRef.current) {
          setItems((response.data.items ?? []) as TaskBankItem[]);
          setTotalCount(response.data.total_count ?? 0);
        }
      } catch (error: unknown) {
        if (requestId === itemsRequestRef.current) {
          setItemsError(getApiErrorMessage(error, "Не удалось загрузить задачи"));
        }
      } finally {
        if (requestId === itemsRequestRef.current) setLoading(false);
      }
    };
    fetchItems();
    return () => { itemsRequestRef.current += 1; };
  }, [courseId, sourceFilter, paragraphFilter, topicFilter, hasAnswerFilter, appliedAdvanced, skip, pageSize, sourcesLoading, itemsRetry]);

  const selectedNumbers = useMemo(() => Object.values(selectedItems).map(item => item.number), [selectedItems]);
  const currentPage = Math.floor(skip / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const hasActiveFilters = Boolean(paragraphDraft || topicDraft || hasAnswerFilter !== "all" || JSON.stringify(advanced) !== JSON.stringify(emptyBankFilters));
  const allPageItemsSelected = items.length > 0 && items.every((item) => Boolean(selectedItems[item.id]));

  const toggleSelection = (item: TaskBankItem) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        if (Object.keys(next).length < 300) next[item.id] = item;
      }
      return next;
    });
  };

  const toggleCurrentPage = () => {
    setSelectedItems((current) => {
      const next = { ...current };
      if (allPageItemsSelected) {
        items.forEach((item) => delete next[item.id]);
      } else {
        items.forEach((item) => {
          if (Object.keys(next).length < 300) next[item.id] = item;
        });
      }
      return next;
    });
  };

  const clearFilters = () => {
    setAdvanced(emptyBankFilters);
    setAppliedAdvanced(emptyBankFilters);
    setParagraphDraft("");
    setTopicDraft("");
    setParagraphFilter("");
    setTopicFilter("");
    setHasAnswerFilter("all");
    setSkip(0);
  };

  const createGeneratedSet = async () => {
    if (!courseId || creatingSet) {
      return;
    }
    setCreatingSet("automatic");
    try {
      const response = await trainerAPI.generateSet(
        {
          source: sourceFilter,
          filters: {
            ...bankFilterParams(appliedAdvanced),
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
    } finally {
      setCreatingSet(null);
    }
  };

  const createManualSet = async () => {
    if (!courseId || creatingSet) {
      return;
    }
    if (selectedNumbers.length === 0) {
      toast.error("Выберите хотя бы одну задачу");
      return;
    }
    setCreatingSet("manual");
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
    } finally {
      setCreatingSet(null);
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

  if (sourcesLoading) {
    return (
      <PageShell title="Банк задач" subtitle="Поиск задач для самостоятельной тренировки">
        <PageLoader label="Загружаем источники банка задач…" />
      </PageShell>
    );
  }

  if (sourcesError) {
    return (
      <PageShell title="Банк задач" subtitle="Поиск задач для самостоятельной тренировки">
        <InlineError description={sourcesError} onRetry={() => setSourcesRetry((value) => value + 1)} />
      </PageShell>
    );
  }

  if (sources.length === 0) {
    return (
      <PageShell title="Банк задач" subtitle="Источники задач подключаются отдельно для каждого курса">
        <EmptyState
          icon={SearchX}
          title="Для этого курса банк задач ещё не подключён"
          description="Задачи другого предмета здесь не показываются. Преподаватель сможет опубликовать подготовленный банк из Picrete Studio."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Банк задач"
      subtitle={teacherMode ? "Подберите задания для работы: условия, изображения и эталонные решения в одном месте" : "Найдите задачи по источнику и теме, затем соберите личный тренировочный набор"}
      actions={
        <Link to={teacherMode ? `/c/${courseId}/create-exam` : `/c/${courseId}/trainer`}>
          <Button variant="outline" className="gap-1.5">
            <Dumbbell className="h-4 w-4" />
            {teacherMode ? "Создать работу" : "Мои тренажёры"}
          </Button>
        </Link>
      }
    >
      <Card className="mb-6 p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Поиск и фильтры</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Результаты обновляются после небольшой паузы ввода</p>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
              <FilterX className="h-4 w-4" />
              Сбросить
            </Button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <Label htmlFor="source">Источник</Label>
            <select
              id="source"
              className={selectClass}
              value={sourceFilter}
              onChange={(event) => {
                clearFilters();
                setSourceFilter(event.target.value);
                setSelectedItems({});
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
          <div className="lg:col-span-2">
            <Label htmlFor="paragraph">Параграф</Label>
            <Input
              id="paragraph"
              list="bank-paragraphs"
              className="mt-1"
              value={paragraphDraft}
              onChange={(event) => setParagraphDraft(event.target.value)}
              placeholder="Например: 7"
            />
          </div>
          <div className="lg:col-span-3">
            <Label htmlFor="topic">Поиск по теме</Label>
            <MathCombobox id="topic" className="mt-1" value={topicDraft} onChange={setTopicDraft}
              options={topicOptions} placeholder="Например: коллоидные растворы" />
          </div>
          <div className="lg:col-span-2">
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
          {!teacherMode && <div className="lg:col-span-2">
            <Label htmlFor="count">Задач в подборке</Label>
            <Input
              id="count"
              className="mt-1"
              type="number"
              min={1}
              max={100}
              value={generateCount}
              onChange={(event) => setGenerateCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))}
            />
            <p className="mt-1 text-xs text-muted-foreground">Для автоматической подборки</p>
          </div>}
        </div>
        <BankAdvancedFilters value={advanced} onChange={setAdvanced} courseId={courseId} source={sourceFilter} listPrefix="bank" onTopics={setTopicOptions} />
        {teacherMode ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-sm text-muted-foreground">Выбрано: {selectedNumbers.length} из 300. Выбор сохраняется при смене страницы и фильтров.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={!selectedNumbers.length} onClick={() => setSelectedItems({})}>Снять выбор</Button>
            <Button variant="accent" disabled={!selectedNumbers.length} onClick={() => navigate(`/c/${courseId}/create-exam`, { state: { bankItems: Object.values(selectedItems) } })}>В новую работу ({selectedNumbers.length})</Button>
          </div>
          {selectedNumbers.length > 0 && <div className="flex max-h-28 w-full flex-wrap gap-2 overflow-y-auto" aria-label="Выбранные задания">
            {Object.values(selectedItems).map(item => <Button key={item.id} variant="secondary" size="sm" onClick={() => toggleSelection(item)} aria-label={`Убрать задачу ${item.number}`}>№ {item.number} ×</Button>)}
          </div>}
        </div> : <div className="mt-5 grid gap-4 border-t pt-5 md:grid-cols-2">
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
          <div className="flex flex-wrap items-end justify-start gap-2 md:justify-end">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={createGeneratedSet}
              disabled={Boolean(creatingSet)}
            >
              <Sparkles className="h-4 w-4" />
              {creatingSet === "automatic" ? "Подбираем…" : "Подобрать случайно"}
            </Button>
            <Button variant="accent" onClick={createManualSet} disabled={Boolean(creatingSet) || selectedNumbers.length === 0}>
              {creatingSet === "manual" ? "Создаём…" : `Создать из выбранных (${selectedNumbers.length})`}
            </Button>
          </div>
        </div>}
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-live="polite">
        <span>Найдено: {totalCount} · показано: {items.length}</span>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={toggleCurrentPage}>
            <CheckSquare className="h-4 w-4" />
            {allPageItemsSelected ? "Снять выбор на странице" : "Выбрать страницу"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4" aria-label="Загружаем задачи" aria-busy="true">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="animate-pulse p-5">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="mt-4 h-4 w-2/3 rounded bg-muted" />
              <div className="mt-2 h-4 w-full rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : itemsError ? (
        <InlineError description={itemsError} onRetry={() => setItemsRetry((value) => value + 1)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="По этим фильтрам задач нет"
          description="Попробуйте изменить источник, параграф или тему поиска."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="virtualized-card p-4 transition-shadow hover:shadow-elegant sm:p-5">
              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{item.number}</Badge>
                    <Badge variant="outline">§ {item.paragraph}</Badge>
                    <BankTaskBadges item={item} />
                    {item.has_answer ? (
                      <Badge variant="success">С ответом</Badge>
                    ) : (
                      <Badge variant="muted">Без ответа</Badge>
                    )}
                  </div>
                  <h3 className="latex-scroll mb-2 font-semibold">
                    <RichText inline>{item.topic}</RichText>
                  </h3>
                  <RichText className="text-sm text-muted-foreground">{item.text}</RichText>
                  {item.images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.images.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => openLightbox(item, index)}
                          className="overflow-hidden rounded-md border transition-shadow hover:shadow-soft"
                          aria-label={`Открыть изображение ${index + 1} к задаче ${item.number}`}
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
                  <BankTaskReference item={item} />
                </div>
                <Button
                  variant={selectedItems[item.id] ? "default" : "outline"}
                  className="min-h-11 w-full sm:min-h-10 sm:w-auto"
                  onClick={() => toggleSelection(item)}
                  aria-pressed={Boolean(selectedItems[item.id])}
                >
                  {selectedItems[item.id] ? "Выбрано" : "Выбрать"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !itemsError && totalCount > 0 && (
        <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Страницы банка задач">
        <Button
          variant="outline"
          className="min-h-11 min-w-11 gap-1.5 px-3 sm:min-w-0 sm:px-4"
          disabled={skip === 0}
          onClick={() => setSkip((prev) => Math.max(0, prev - pageSize))}
          aria-label={`Предыдущая страница, сейчас страница ${currentPage}`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Назад</span>
        </Button>
        <span className="text-center text-sm text-muted-foreground" aria-live="polite">
          Страница {currentPage} из {totalPages}
        </span>
        <Button
          variant="outline"
          className="min-h-11 min-w-11 gap-1.5 px-3 sm:min-w-0 sm:px-4"
          disabled={skip + pageSize >= totalCount}
          onClick={() => setSkip((prev) => prev + pageSize)}
          aria-label={`Следующая страница, сейчас страница ${currentPage}`}
        >
          <span className="hidden sm:inline">Вперёд</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        </nav>
      )}

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
