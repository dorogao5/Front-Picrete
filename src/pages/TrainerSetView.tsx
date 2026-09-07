import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Dumbbell, FileText } from "lucide-react";
import { toast } from "sonner";

import AuthImage from "@/components/AuthImage";
import ImageLightbox from "@/components/ImageLightbox";
import { EmptyState } from "@/components/EmptyState";
import { InlineError } from "@/components/InlineError";
import { PageLoader, PageShell } from "@/components/PageShell";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchImageAsBlobUrl, getApiErrorMessage, materialsAPI, trainerAPI } from "@/lib/api";
import type { TrainerSet } from "@/lib/api";

const TrainerSetView = () => {
  const { courseId, setId } = useParams<{ courseId: string; setId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [setData, setSetData] = useState<TrainerSet | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [openingMaterials, setOpeningMaterials] = useState(false);
  const [openedAnswers, setOpenedAnswers] = useState<Record<string, boolean>>({});

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!courseId || !setId) {
      return;
    }
    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [setResponse] = await Promise.all([trainerAPI.getSet(setId, courseId)]);
        setSetData(setResponse.data as TrainerSet);
        setOpenedAnswers({});
      } catch (error: unknown) {
        setLoadError(getApiErrorMessage(error, "Не удалось загрузить тренажёр"));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId, reloadKey, setId]);

  const handleOpenMaterials = async () => {
    if (!courseId) return;
    setOpeningMaterials(true);
    try {
      await materialsAPI.openAdditionPdf(courseId);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось открыть дополнительные материалы"));
    } finally {
      setOpeningMaterials(false);
    }
  };

  const allImageUrls = useMemo(
    () => (setData ? setData.items.flatMap((item) => item.images.map((image) => image.full_url)) : []),
    [setData]
  );
  const imageOffsets = useMemo(() => {
    let offset = 0;
    return (setData?.items ?? []).map((item) => {
      const currentOffset = offset;
      offset += item.images.length;
      return currentOffset;
    });
  }, [setData]);

  const openLightbox = async (globalIndex: number) => {
    if (allImageUrls.length === 0) return;
    try {
      const blobUrls = await Promise.all(allImageUrls.map((url) => fetchImageAsBlobUrl(url)));
      setLightboxImages(blobUrls);
      setLightboxIndex(globalIndex);
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

  const toggleAnswer = (itemId: string) => {
    setOpenedAnswers((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  if (!courseId) {
    return null;
  }

  return (
    <PageShell
      backLabel="К списку тренажёров"
      onBack={() => navigate(`/c/${courseId}/trainer`)}
      title={setData?.title ?? "Тренажёр"}
      subtitle={
        setData ? `${setData.source_title} · задач: ${setData.items.length}` : "Загружаем..."
      }
      actions={
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={handleOpenMaterials}
          disabled={openingMaterials}
        >
          <FileText className="h-4 w-4" />
          {openingMaterials ? "Открываем PDF…" : "Открыть справочник (PDF)"}
        </Button>
      }
    >
      {loading ? (
        <PageLoader label="Загружаем тренажёр..." />
      ) : loadError ? (
        <InlineError description={loadError} onRetry={() => setReloadKey((value) => value + 1)} />
      ) : !setData ? (
        <EmptyState
          icon={Dumbbell}
          title="Тренажёр не найден"
          description="Возможно, набор был удалён."
          action={
            <Button variant="outline" onClick={() => navigate(`/c/${courseId}/trainer`)}>
              К списку тренажёров
            </Button>
          }
        />
      ) : setData.items.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="В этом наборе нет задач"
          description="Вернитесь в банк и соберите новую подборку."
          action={<Button variant="outline" onClick={() => navigate(`/c/${courseId}/task-bank`)}>Открыть банк задач</Button>}
        />
      ) : (
        <>
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">Самопроверка без подсказок</p>
            <p className="text-sm text-muted-foreground">Сначала решите задачу, затем осознанно откройте ответ.</p>
          </div>
          <p className="text-sm" aria-live="polite">
            Ответов открыто: <span className="font-semibold">{Object.values(openedAnswers).filter(Boolean).length}</span> из {setData.items.filter((item) => item.has_answer).length}
          </p>
        </Card>
        <div className="space-y-5">
          {setData.items.map((item, itemIndex) => {
            const imageOffset = imageOffsets[itemIndex] ?? 0;

            return (
              <Card key={item.id} className="virtualized-card p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                    {item.number}
                  </span>
                  <span className="text-xs text-muted-foreground">§ {item.paragraph}</span>
                </div>
                <h2 className="mb-2 font-semibold"><RichText inline>{item.topic}</RichText></h2>
                <RichText className="text-sm text-muted-foreground">{item.text}</RichText>
                {item.has_answer && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAnswer(item.id)}
                      aria-expanded={Boolean(openedAnswers[item.id])}
                    >
                      {openedAnswers[item.id] ? "Скрыть ответ" : "Я решил — сверить ответ"}
                    </Button>
                  </div>
                )}
                {item.has_answer && openedAnswers[item.id] && (
                  <div className="mt-3 rounded-md border border-success/30 bg-success/10 p-3" aria-live="polite">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ответ
                    </p>
                    <div className="mt-1 text-sm">
                      {item.answer && item.answer.trim().length > 0
                        ? <RichText>{item.answer}</RichText>
                        : "Ответ в источнике не заполнен"}
                    </div>
                  </div>
                )}
                {item.images.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.images.map((image, imageIndex) => (
                      <button
                        type="button"
                        key={image.id}
                        onClick={() => openLightbox(imageOffset + imageIndex)}
                        className="overflow-hidden rounded-md border transition-shadow hover:shadow-soft"
                        aria-label={`Открыть изображение ${imageIndex + 1} к задаче ${item.number}`}
                      >
                        <AuthImage
                          src={image.thumbnail_url}
                          alt={`Иллюстрация ${item.number}`}
                          className="h-20 w-20 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        </>
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

export default TrainerSetView;
