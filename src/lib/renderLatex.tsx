import 'katex/dist/katex.min.css';
import katex from 'katex';
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

const TABLE_REGEX = /(<table[\s\S]*?<\/table>)/gi;
const LATEX_TOKEN_REGEX = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;

function sanitizeTableHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)=(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "");
}

function renderLatexTokenToHtml(token: string): string {
  if (token.startsWith('$$') && token.endsWith('$$')) {
    return katex.renderToString(token.slice(2, -2).trim(), { throwOnError: false, displayMode: true });
  }
  if (token.startsWith('\\[') && token.endsWith('\\]')) {
    return katex.renderToString(token.slice(2, -2).trim(), { throwOnError: false, displayMode: true });
  }
  if (token.startsWith('\\(') && token.endsWith('\\)')) {
    return katex.renderToString(token.slice(2, -2).trim(), { throwOnError: false, displayMode: false });
  }
  if (token.startsWith('$') && token.endsWith('$')) {
    return katex.renderToString(token.slice(1, -1).trim(), { throwOnError: false, displayMode: false });
  }
  return token;
}

function renderLatexInsideTableHtml(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach((node) => {
    const value = node.nodeValue ?? "";
    if (!LATEX_TOKEN_REGEX.test(value)) {
      LATEX_TOKEN_REGEX.lastIndex = 0;
      return;
    }
    LATEX_TOKEN_REGEX.lastIndex = 0;

    const parts = value.split(LATEX_TOKEN_REGEX);
    const fragment = document.createDocumentFragment();

    parts.forEach((part) => {
      if (!part) return;
      if (LATEX_TOKEN_REGEX.test(part)) {
        LATEX_TOKEN_REGEX.lastIndex = 0;
        const wrapper = document.createElement("span");
        wrapper.innerHTML = renderLatexTokenToHtml(part);
        while (wrapper.firstChild) {
          fragment.appendChild(wrapper.firstChild);
        }
      } else {
        LATEX_TOKEN_REGEX.lastIndex = 0;
        fragment.appendChild(document.createTextNode(part));
      }
    });

    node.parentNode?.replaceChild(fragment, node);
  });

  return template.innerHTML;
}

/**
 * Renders task text with support for embedded HTML tables and LaTeX in plain parts.
 * Used for trusted task-bank content where backend may send <table>...</table>.
 */
export function renderTaskText(text: string): React.ReactNode {
  if (!text) return text;

  const chunks = text.split(TABLE_REGEX);

  return chunks.map((chunk, index) => {
    if (!chunk) return null;

    if (chunk.trim().toLowerCase().startsWith("<table")) {
      const sanitizedHtml = sanitizeTableHtml(chunk);
      const renderedHtml = renderLatexInsideTableHtml(sanitizedHtml);
      return (
        <div
          key={`table-${index}`}
          className="task-rich-text my-3 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      );
    }

    return <span key={`text-${index}`}>{renderLatex(chunk)}</span>;
  });
}
