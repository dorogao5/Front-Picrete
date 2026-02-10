import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

/**
 * Renders text with mixed plain content and LaTeX.
 * Supported delimiters:
 * - Inline: $...$, \(...\)
 * - Block: $$...$$, \[...\]
 */
export function renderLatex(text: string): React.ReactNode {
  if (!text) return text;

  const tokenRegex = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  const tokens = text.split(tokenRegex);

  const renderPlainText = (value: string, keyPrefix: string) => {
    const lines = value.split('\n');
    return (
      <span key={keyPrefix}>
        {lines.map((line, lineIndex) => (
          <span key={`${keyPrefix}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  };

  return tokens.map((token, index) => {
    if (!token) return null;

    if (token.startsWith('$$') && token.endsWith('$$')) {
      return <BlockMath key={`block-dollar-${index}`}>{token.slice(2, -2).trim()}</BlockMath>;
    }
    if (token.startsWith('\\[') && token.endsWith('\\]')) {
      return <BlockMath key={`block-bracket-${index}`}>{token.slice(2, -2).trim()}</BlockMath>;
    }
    if (token.startsWith('\\(') && token.endsWith('\\)')) {
      return <InlineMath key={`inline-paren-${index}`}>{token.slice(2, -2).trim()}</InlineMath>;
    }
    if (token.startsWith('$') && token.endsWith('$')) {
      return <InlineMath key={`inline-dollar-${index}`}>{token.slice(1, -1).trim()}</InlineMath>;
    }

    return renderPlainText(token, `text-${index}`);
  });
}
