import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { cleanOcrMarkdown } from "@/lib/ocr";

interface OcrMarkdownPanelProps {
  markdown?: string | null;
  previewLines?: number;
  alwaysExpanded?: boolean;
  hideToggle?: boolean;
}

const OcrMarkdownPanel = ({
  markdown,
  previewLines = 8,
  alwaysExpanded = false,
  hideToggle = false,
}: OcrMarkdownPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const cleaned = useMemo(() => cleanOcrMarkdown(markdown), [markdown]);
  const lines = useMemo(() => cleaned.split("\n"), [cleaned]);
  const needsCollapse = lines.length > previewLines;
  const isExpanded = alwaysExpanded || expanded;
  const visibleText = isExpanded || !needsCollapse ? cleaned : lines.slice(0, previewLines).join("\n");

  return (
    <div className="min-w-0 space-y-2">
      <div className="min-w-0 overflow-hidden rounded border bg-background p-3 text-sm">
        {visibleText ? (
          <RichText className="ocr-rich-text min-w-0 break-words [overflow-wrap:anywhere]">{visibleText}</RichText>
        ) : (
          <span className="text-muted-foreground">Распознанный текст пока недоступен</span>
        )}
      </div>
      {needsCollapse && !alwaysExpanded && !hideToggle && (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? "Свернуть распознанный текст" : "Показать весь распознанный текст"}
        </Button>
      )}
    </div>
  );
};

export default OcrMarkdownPanel;
