import { useMemo, useState } from "react";

import { geometryForBlock, OcrChunkBlock } from "@/lib/ocr";

interface OcrImageOverlayProps {
  imageUrl?: string | null;
  blocks: OcrChunkBlock[];
  selectedChunkIndex?: number | null;
  alt: string;
  className?: string;
}

const OcrImageOverlay = ({
  imageUrl,
  blocks,
  selectedChunkIndex = null,
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
    <div className={`relative overflow-hidden rounded border bg-muted/20 ${className ?? ""}`.trim()}>
      <img
        src={imageUrl}
        alt={alt}
        className="w-full rounded object-contain"
        onLoad={(event) => {
          const target = event.currentTarget;
          if (target.naturalWidth > 0 && target.naturalHeight > 0) {
            setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
          }
        }}
      />

      <div className="pointer-events-none absolute inset-0">
        {geometries.map((geometry, index) => {
          if (!geometry) return null;
          const selected = index === selectedChunkIndex;

          return (
            <div key={`ocr-geometry-${index}`}>
              {geometry.bbox && (
                <div
                  className={`absolute rounded border-2 ${
                    selected ? "border-primary bg-primary/15" : "border-primary/40 bg-primary/5"
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
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon
                    points={geometry.polygon.map((point) => `${point.x},${point.y}`).join(" ")}
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

export default OcrImageOverlay;
