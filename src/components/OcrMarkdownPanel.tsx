import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cleanOcrMarkdown } from "@/lib/ocr";
import { renderTaskText } from "@/lib/renderLatex";

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
          <div className="ocr-rich-text min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {renderTaskText(visibleText)}
          </div>
        ) : (
          <span className="text-muted-foreground">OCR markdown отсутствует</span>
        )}
      </div>
      {needsCollapse && !alwaysExpanded && !hideToggle && (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? "Свернуть OCR текст" : "Показать полный OCR текст"}
        </Button>
      )}
    </div>
  );
};

export default OcrMarkdownPanel;
