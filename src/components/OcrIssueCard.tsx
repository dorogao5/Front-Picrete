import { ArrowRight, X } from "lucide-react";

import { ChunkTypeChip } from "@/components/ChunkListPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { cleanOcrMarkdown } from "@/lib/ocr";
import { renderTaskText } from "@/lib/renderLatex";
import { cn } from "@/lib/utils";

export interface OcrIssueView {
  anchor: Record<string, unknown>;
  original_text?: string | null;
  suggested_text?: string | null;
  note: string;
  severity: string;
}

interface OcrIssueCardProps {
  issue: OcrIssueView;
  pageNumber?: number | null;
  onRemove?: () => void;
  className?: string;
}

export const OcrIssueCard = ({ issue, pageNumber, onRemove, className }: OcrIssueCardProps) => {
  const blockType = typeof issue.anchor.block_type === "string" ? issue.anchor.block_type : undefined;
  const correctedType =
    typeof issue.anchor.corrected_block_type === "string" && issue.anchor.corrected_block_type.trim()
      ? issue.anchor.corrected_block_type
      : null;

  return (
    <div className={cn("rounded-md border bg-card p-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge domain="severity" value={issue.severity} />
        <ChunkTypeChip blockType={blockType} />
        {correctedType && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <ChunkTypeChip blockType={correctedType} />
            <span className="text-[11px]">верный тип</span>
          </span>
        )}
        {typeof pageNumber === "number" && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">стр. {pageNumber}</span>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className={cn("h-6 px-1.5 text-muted-foreground hover:text-destructive", typeof pageNumber !== "number" && "ml-auto")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="ocr-rich-text mt-2 text-sm">{renderTaskText(issue.note)}</div>

      {(issue.original_text || issue.suggested_text) && (
        <div className="mt-2 space-y-1.5 border-t pt-2 text-xs">
          {issue.original_text && (
            <div className="flex gap-2">
              <span className="w-20 flex-shrink-0 text-muted-foreground">Распознано</span>
              <div className="ocr-rich-text min-w-0 text-muted-foreground line-through decoration-destructive/40">
                {renderTaskText(cleanOcrMarkdown(issue.original_text))}
              </div>
            </div>
          )}
          {issue.suggested_text && (
            <div className="flex gap-2">
              <span className="w-20 flex-shrink-0 text-muted-foreground">Должно быть</span>
              <div className="ocr-rich-text min-w-0 font-medium text-success">
                {renderTaskText(issue.suggested_text)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
