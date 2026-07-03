import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, Wand2 } from "lucide-react";

import {
  chunkColor,
  chunkKindMeta,
  detectOcrOrientation,
  geometryForBlock,
  OcrChunkBlock,
  type OcrOrientation,
} from "@/lib/ocr";

interface OcrImageOverlayProps {
  imageUrl?: string | null;
  blocks: OcrChunkBlock[];
  selectedChunkIndex?: number | null;
  onSelectChunk?: (index: number) => void;
  alt: string;
  className?: string;
}

/* Обратное преобразование клика: экранная точка → координаты содержимого до поворота */
const unrotatePoint = (u: number, v: number, rotation: number): { x: number; y: number } => {
  switch (rotation) {
    case 90:
      return { x: v, y: 100 - u };
    case 180:
      return { x: 100 - u, y: 100 - v };
    case 270:
      return { x: 100 - v, y: u };
    default:
      return { x: u, y: v };
  }
};

const OcrImageOverlay = ({
  imageUrl,
  blocks,
  selectedChunkIndex = null,
  onSelectChunk,
  alt,
  className,
}: OcrImageOverlayProps) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number } | null>(null);
  const [viewRotation, setViewRotation] = useState(0);
  const userRotatedRef = useRef(false);

  const syncRenderedSize = () => {
    const target = imageRef.current;
    if (!target) return;
    const width = target.clientWidth;
    const height = target.clientHeight;
    if (width > 0 && height > 0) {
      setRenderedSize({ width, height });
    }
  };

  /* Самодиагностика: если кадр координат OCR не совпадает с ориентацией картинки
     (EXIF-повороты и т.п.) — боксы поворачиваются автоматически. */
  const orientation: OcrOrientation = useMemo(
    () => detectOcrOrientation(blocks, imageSize?.width ?? null, imageSize?.height ?? null),
    [blocks, imageSize]
  );

  useEffect(() => {
    if (userRotatedRef.current) return;
    // Разворачиваем картинку так, чтобы текст был вертикально (обратный поворот)
    setViewRotation(orientation === 0 ? 0 : (360 - orientation) % 360);
  }, [orientation]);

  const geometries = useMemo(
    () =>
      blocks.map((block) =>
        geometryForBlock(block, imageSize?.width ?? null, imageSize?.height ?? null, orientation)
      ),
    [blocks, imageSize, orientation]
  );

  const hitTargets = useMemo(
    () =>
      geometries
        .map((geometry, index) => {
          if (!geometry) return null;
          const area = geometryArea(geometry);
          return area > 0 ? { index, geometry, area } : null;
        })
        .filter((item): item is { index: number; geometry: NonNullable<typeof geometries[number]>; area: number } =>
          Boolean(item)
        ),
    [geometries]
  );

  useEffect(() => {
    syncRenderedSize();
    const target = imageRef.current;
    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncRenderedSize();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [imageUrl]);

  if (!imageUrl) {
    return (
      <div className="rounded border p-4 text-sm text-muted-foreground">
        Не удалось получить URL изображения
      </div>
    );
  }

  const rotated = viewRotation % 180 !== 0;
  const outerStyle =
    rotated && renderedSize
      ? { width: renderedSize.height, height: renderedSize.width }
      : undefined;
  const innerStyle =
    viewRotation === 0
      ? undefined
      : rotated
        ? {
            position: "absolute" as const,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) rotate(${viewRotation}deg)`,
          }
        : { transform: `rotate(${viewRotation}deg)` };

  return (
    <div className="relative inline-block max-w-full self-start">
      <div className="relative overflow-hidden rounded border bg-muted/20" style={outerStyle}>
        <div className="relative" style={innerStyle}>
          <img
            ref={imageRef}
            src={imageUrl}
            alt={alt}
            className={`block h-auto w-auto max-w-full rounded object-contain ${className ?? ""}`.trim()}
            onLoad={(event) => {
              const target = event.currentTarget;
              if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
                setRenderedSize({ width: target.clientWidth, height: target.clientHeight });
              }
            }}
          />

          {renderedSize && (
            <div
              className={`absolute left-0 top-0 ${onSelectChunk ? "cursor-pointer" : ""}`.trim()}
              style={{ width: renderedSize.width, height: renderedSize.height }}
              onClick={(event) => {
                if (!onSelectChunk || hitTargets.length === 0) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                // rect уже повёрнут трансформацией — приводим клик к координатам содержимого
                const u = ((event.clientX - rect.left) / rect.width) * 100;
                const v = ((event.clientY - rect.top) / rect.height) * 100;
                const { x, y } = unrotatePoint(u, v, viewRotation);
                const target = findBestHitTarget(x, y, hitTargets);
                if (target !== null) {
                  onSelectChunk(target);
                }
              }}
            >
              {geometries.map((geometry, index) => {
                if (!geometry) return null;
                const block = blocks[index];
                const selected = index === selectedChunkIndex;
                const hasPolygon = Array.isArray(geometry.polygon) && geometry.polygon.length >= 3;
                const kindLabel = chunkKindMeta(block?.block_type).label;

                return (
                  <div key={`ocr-geometry-${index}`} title={`${kindLabel} #${index + 1}`}>
                    {!hasPolygon && geometry.bbox && (
                      <div
                        className="pointer-events-none absolute rounded-sm"
                        style={{
                          left: `${geometry.bbox.left}%`,
                          top: `${geometry.bbox.top}%`,
                          width: `${geometry.bbox.width}%`,
                          height: `${geometry.bbox.height}%`,
                          border: `2px solid ${chunkColor(block?.block_type, selected ? 1 : 0.5)}`,
                          backgroundColor: chunkColor(block?.block_type, selected ? 0.2 : 0.06),
                          boxShadow: selected
                            ? `0 0 0 2px ${chunkColor(block?.block_type, 0.25)}`
                            : undefined,
                        }}
                      />
                    )}

                    {geometry.polygon && (
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                      >
                        <polygon
                          points={geometry.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                          className="pointer-events-none"
                          style={{
                            fill: chunkColor(block?.block_type, selected ? 0.22 : 0.07),
                            stroke: chunkColor(block?.block_type, selected ? 1 : 0.55),
                          }}
                          strokeWidth={selected ? 0.8 : 0.4}
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        {orientation !== 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-card/90 px-2 py-1 text-[11px] font-medium text-accent shadow-soft backdrop-blur"
            title="Координаты распознавания не совпадали с ориентацией фото — исправлено автоматически"
          >
            <Wand2 className="h-3 w-3" />
            ориентация исправлена
          </span>
        )}
        <button
          type="button"
          className="rounded-md bg-card/90 p-1.5 text-muted-foreground shadow-soft backdrop-blur transition-colors hover:text-foreground"
          title="Повернуть фото (разметка повернётся вместе с ним)"
          onClick={() => {
            userRotatedRef.current = true;
            setViewRotation((prev) => (prev + 90) % 360);
          }}
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const findBestHitTarget = (
  x: number,
  y: number,
  targets: Array<{ index: number; geometry: { bbox?: { left: number; top: number; width: number; height: number }; polygon?: Array<{ x: number; y: number }> }; area: number }>
): number | null => {
  const hits = targets.filter(({ geometry }) => pointInsideGeometry(x, y, geometry));
  if (hits.length === 0) {
    return null;
  }
  hits.sort((a, b) => a.area - b.area);
  return hits[0].index;
};

const pointInsideGeometry = (
  x: number,
  y: number,
  geometry: { bbox?: { left: number; top: number; width: number; height: number }; polygon?: Array<{ x: number; y: number }> }
): boolean => {
  if (geometry.polygon && geometry.polygon.length >= 3) {
    return pointInPolygon(x, y, geometry.polygon);
  }
  if (geometry.bbox) {
    const { left, top, width, height } = geometry.bbox;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  }
  return false;
};

const pointInPolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

const geometryArea = (geometry: {
  bbox?: { left: number; top: number; width: number; height: number };
  polygon?: Array<{ x: number; y: number }>;
}): number => {
  if (geometry.polygon && geometry.polygon.length >= 3) {
    return polygonArea(geometry.polygon);
  }
  if (geometry.bbox) {
    return Math.max(0, geometry.bbox.width * geometry.bbox.height);
  }
  return 0;
};

const polygonArea = (polygon: Array<{ x: number; y: number }>): number => {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum / 2);
};

export default OcrImageOverlay;
