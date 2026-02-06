import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

/**
 * Renders a string that may contain LaTeX markup ($..$ for inline, $$...$$ for block).
 * Splits by newlines so each line is rendered independently.
 */
export function renderLatex(text: string): React.ReactNode {
  if (!text) return text;

  try {
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
      const parts = line.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/);

      const lineContent = parts.map((part, partIndex) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          const mathContent = part.slice(2, -2).trim();
          return <BlockMath key={partIndex}>{mathContent}</BlockMath>;
        } else if (part.startsWith("$") && part.endsWith("$")) {
          const mathContent = part.slice(1, -1).trim();
          return <InlineMath key={partIndex}>{mathContent}</InlineMath>;
        }
        return <span key={partIndex}>{part}</span>;
      });

      return (
        <span key={lineIndex}>
          {lineContent}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  } catch {
    return <span>{text}</span>;
  }
}
