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

  if (!imageUrl) {
    return (
      <div className="rounded border p-4 text-sm text-muted-foreground">
        Не удалось получить URL изображения
      </div>
    );
  }

  return (
    <div
      className={`relative min-w-0 w-full self-start overflow-hidden rounded border bg-muted/20 ${className ?? ""}`.trim()}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="block w-full rounded object-contain"
        onLoad={(event) => {
          const target = event.currentTarget;
          if (target.naturalWidth > 0 && target.naturalHeight > 0) {
            setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
          }
        }}
      />

      <div className="absolute inset-0">
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
                      ? "pointer-events-auto cursor-pointer border-primary bg-primary/15"
                      : "pointer-events-auto cursor-pointer border-primary/40 bg-primary/5"
                  }`}
                  style={{
                    left: `${geometry.bbox.left}%`,
                    top: `${geometry.bbox.top}%`,
                    width: `${geometry.bbox.width}%`,
                    height: `${geometry.bbox.height}%`,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectChunk?.(index);
                  }}
                />
              )}

              {geometry.polygon && (
                <svg
                  className="pointer-events-auto absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={geometry.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
                    className="cursor-pointer pointer-events-auto"
                    style={{
                      fill: selected ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.08)",
                      stroke: selected ? "rgba(124,58,237,1)" : "rgba(124,58,237,0.55)",
                    }}
                    strokeWidth={selected ? 0.8 : 0.4}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectChunk?.(index);
                    }}
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

export default OcrImageOverlay;
