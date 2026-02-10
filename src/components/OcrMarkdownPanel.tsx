import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cleanOcrMarkdown } from "@/lib/ocr";
import { renderLatex } from "@/lib/renderLatex";

interface OcrMarkdownPanelProps {
  markdown?: string | null;
  previewLines?: number;
}

const OcrMarkdownPanel = ({ markdown, previewLines = 8 }: OcrMarkdownPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const cleaned = useMemo(() => cleanOcrMarkdown(markdown), [markdown]);
  const lines = useMemo(() => cleaned.split("\n"), [cleaned]);
  const needsCollapse = lines.length > previewLines;
  const visibleText = expanded || !needsCollapse ? cleaned : lines.slice(0, previewLines).join("\n");

  return (
    <div className="space-y-2">
      <div className="rounded border bg-background p-3 text-sm">
        {visibleText ? (
          <div className="whitespace-pre-wrap break-words">{renderLatex(visibleText)}</div>
        ) : (
          <span className="text-muted-foreground">OCR markdown отсутствует</span>
        )}
      </div>
      {needsCollapse && (
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? "Свернуть OCR текст" : "Показать полный OCR текст"}
        </Button>
      )}
    </div>
  );
};

export default OcrMarkdownPanel;
