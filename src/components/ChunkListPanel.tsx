import { useMemo } from "react";

import {
  CHUNK_KINDS,
  chunkColor,
  chunkDisplayText,
  chunkKindForType,
  chunkKindMeta,
  OcrChunkBlock,
} from "@/lib/ocr";
import { renderTaskText } from "@/lib/renderLatex";
import { cn } from "@/lib/utils";

export const ChunkTypeChip = ({
  blockType,
  className,
}: {
  blockType?: string | null;
  className?: string;
}) => {
  const meta = chunkKindMeta(blockType);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      style={{
        color: chunkColor(blockType),
        backgroundColor: chunkColor(blockType, 0.1),
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: chunkColor(blockType) }}
      />
      {meta.label}
    </span>
  );
};

export const ChunkLegend = ({ blocks, className }: { blocks: OcrChunkBlock[]; className?: string }) => {
  const presentKinds = useMemo(() => {
    const kinds = new Set(blocks.map((block) => chunkKindForType(block.block_type)));
    return Object.values(CHUNK_KINDS).filter((meta) => kinds.has(meta.kind));
  }, [blocks]);

  if (presentKinds.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {presentKinds.map((meta) => (
        <span key={meta.kind} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ backgroundColor: `hsl(var(${meta.colorVar}))` }}
          />
          {meta.label}
        </span>
      ))}
    </div>
  );
};

interface ChunkListPanelProps {
  blocks: OcrChunkBlock[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  listMaxHeight?: string;
  className?: string;
  editedIndexes?: Set<number>;
}

export const ChunkListPanel = ({
  blocks,
  selectedIndex,
  onSelect,
  listMaxHeight = "max-h-[46vh]",
  className,
  editedIndexes,
}: ChunkListPanelProps) => {
  if (blocks.length === 0) {
    return (
      <p className={cn("rounded-md border border-dashed p-3 text-xs text-muted-foreground", className)}>
        В ответе OCR нет распознанных блоков.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ChunkLegend blocks={blocks} />
      <div className={cn("space-y-1.5 overflow-y-auto rounded-md border bg-card p-1.5", listMaxHeight)}>
        {blocks.map((block, index) => {
          const rendered = chunkDisplayText(block);
          const selected = selectedIndex === index;
          return (
            <button
              key={`${block.id ?? "chunk"}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "w-full rounded-md border-l-2 p-2 text-left text-xs transition-colors",
                selected ? "bg-secondary/80" : "hover:bg-secondary/40"
              )}
              style={{
                borderLeftColor: chunkColor(block.block_type, selected ? 1 : 0.45),
                backgroundColor: selected ? chunkColor(block.block_type, 0.08) : undefined,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <ChunkTypeChip blockType={block.block_type} />
                <span className="flex items-center gap-1.5">
                  {editedIndexes?.has(index) && (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      исправлено
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">#{index + 1}</span>
                </span>
              </div>
              <div className="mt-1.5 max-h-24 overflow-auto text-muted-foreground">
                <div className="ocr-rich-text text-[11px] leading-snug">
                  {rendered ? renderTaskText(rendered) : "(пустой блок)"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
