import { useMemo, useState } from "react";

import { geometryForBlock, OcrChunkBlock } from "@/lib/ocr";

interface OcrImageOverlayProps {
  imageUrl?: string | null;
  blocks: OcrChunkBlock[];
  selectedChunkIndex?: number | null;
  onSelectChunk?: (index: number) => void;
  alt: string;
  className?: string;
}

const OcrImageOverlay = ({
  imageUrl,
  blocks,
  selectedChunkIndex = null,
  onSelectChunk,
  alt,
  className,
}: OcrImageOverlayProps) => {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const geometries = useMemo(
    () =>
      blocks.map((block) =>
        geometryForBlock(block, imageSize?.width ?? null, imageSize?.height ?? null)
      ),
    [blocks, imageSize]
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

  if (!imageUrl) {
    return (
      <div className="rounded border p-4 text-sm text-muted-foreground">
        Не удалось получить URL изображения
      </div>
    );
  }

  return (
    <div className="relative inline-block max-w-full self-start overflow-hidden rounded border bg-muted/20">
      <img
        src={imageUrl}
        alt={alt}
        className={`block h-auto w-auto max-w-full rounded object-contain ${className ?? ""}`.trim()}
        onLoad={(event) => {
          const target = event.currentTarget;
          if (target.naturalWidth > 0 && target.naturalHeight > 0) {
            setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
          }
        }}
      />

      <div
        className="absolute inset-0"
        onClick={(event) => {
          if (!onSelectChunk || hitTargets.length === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          const target = findBestHitTarget(x, y, hitTargets);
          if (target !== null) {
            onSelectChunk(target);
          }
        }}
      >
        {geometries.map((geometry, index) => {
          if (!geometry) return null;
          const selected = index === selectedChunkIndex;
          const hasPolygon = Array.isArray(geometry.polygon) && geometry.polygon.length >= 3;

          return (
            <div key={`ocr-geometry-${index}`}>
              {!hasPolygon && geometry.bbox && (
                <div
                  className={`absolute rounded border-2 ${
                    selected
                      ? "pointer-events-none border-primary bg-primary/15"
                      : "pointer-events-none border-primary/40 bg-primary/5"
                  }`}
                  style={{
                    left: `${geometry.bbox.left}%`,
                    top: `${geometry.bbox.top}%`,
                    width: `${geometry.bbox.width}%`,
                    height: `${geometry.bbox.height}%`,
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
                      fill: selected ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.08)",
                      stroke: selected ? "rgba(124,58,237,1)" : "rgba(124,58,237,0.55)",
                    }}
                    strokeWidth={selected ? 0.8 : 0.4}
                  />
                </svg>
              )}
            </div>
          );
        })}
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
