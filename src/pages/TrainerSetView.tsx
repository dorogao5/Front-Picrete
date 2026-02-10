import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ImageLightbox from "@/components/ImageLightbox";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getApiErrorMessage, materialsAPI, trainerAPI } from "@/lib/api";
import type { TrainerSet } from "@/lib/api";
import { toast } from "sonner";

const TrainerSetView = () => {
  const { courseId, setId } = useParams<{ courseId: string; setId: string }>();
  const [loading, setLoading] = useState(true);
  const [setData, setSetData] = useState<TrainerSet | null>(null);
  const [openingMaterials, setOpeningMaterials] = useState(false);

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!courseId || !setId) {
      return;
    }
    const loadData = async () => {
      setLoading(true);
      try {
        const [setResponse] = await Promise.all([trainerAPI.getSet(setId, courseId)]);
        setSetData(setResponse.data as TrainerSet);
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, "Ошибка загрузки тренажера"));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [courseId, setId]);

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

  const allImages = useMemo(
    () => (setData ? setData.items.flatMap((item) => item.images.map((image) => image.full_url)) : []),
    [setData]
  );

  const openLightbox = (globalIndex: number) => {
    setLightboxImages(allImages);
    setLightboxIndex(globalIndex);
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
            <h1 className="text-4xl font-bold mb-2">{setData?.title ?? "Тренажер"}</h1>
            <p className="text-muted-foreground">
              {setData ? `${setData.source_title} • задач: ${setData.items.length}` : "Загрузка..."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/c/${courseId}/trainer`}>
              <Button variant="outline">Назад к списку</Button>
            </Link>
            <Button onClick={handleOpenMaterials} disabled={openingMaterials}>
              {openingMaterials ? "Открытие..." : "Дополнительные материалы"}
            </Button>
          </div>
        </div>

        {loading || !setData ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Загрузка...</p>
          </Card>
        ) : (
          <div className="space-y-5">
            {setData.items.map((item, itemIndex) => {
              const imageOffset = setData.items
                .slice(0, itemIndex)
                .reduce((sum, current) => sum + current.images.length, 0);

              return (
                <Card key={item.id} className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {item.number}
                    </span>
                    <span className="text-xs text-muted-foreground">§ {item.paragraph}</span>
                  </div>
                  <h2 className="font-semibold mb-2">{item.topic}</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.text}</p>
                  {item.images.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.images.map((image, imageIndex) => (
                        <button
                          type="button"
                          key={image.id}
                          onClick={() => openLightbox(imageOffset + imageIndex)}
                          className="border rounded overflow-hidden"
                        >
                          <img
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
        )}
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

export default TrainerSetView;
