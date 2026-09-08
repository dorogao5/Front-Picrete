import "katex/dist/katex.min.css";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { MathViewport } from "@/components/MathViewport";
import remarkReadableMath from "@/lib/remarkReadableMath";

import AuthImage from "@/components/AuthImage";
import { cn } from "@/lib/utils";

interface RichTextProps {
  children: string;
  className?: string;
  inline?: boolean;
}

const isProtectedApiImage = (src: string) => {
  if (src.startsWith("/api/")) return true;
  if (typeof window === "undefined") return false;

  try {
    const url = new URL(src, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

const ExternalImage = ({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) => {
  if (!src) return null;

  const imageAlt = alt?.trim() || "Иллюстрация к материалу";
  const className = cn("my-4 max-h-[32rem] max-w-full rounded-md border object-contain", props.className);

  if (isProtectedApiImage(src)) {
    return <AuthImage src={src} alt={imageAlt} className={className} />;
  }

  return <img {...props} src={src} alt={imageAlt} loading="lazy" decoding="async" className={className} />;
};

const createComponents = (inline: boolean): Components => ({
  h1: ({ children }) =>
    inline ? <strong>{children}</strong> : <h2 className="mb-3 mt-5 text-xl font-semibold first:mt-0">{children}</h2>,
  h2: ({ children }) =>
    inline ? <strong>{children}</strong> : <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) =>
    inline ? <strong>{children}</strong> : <h4 className="mb-2 mt-4 font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) =>
    inline ? <span>{children}</span> : <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-accent/50 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
    >
      {children}
      <span className="sr-only"> (откроется в новой вкладке)</span>
    </a>
  ),
  table: ({ children }) => (
    <div className="my-4 max-w-full overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b bg-muted/70 px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b px-3 py-2 align-top last:border-r-0">{children}</td>,
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-md bg-foreground p-3 text-sm text-background">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.92em]", className)}>{children}</code>
  ),
  span: ({ node, children, ...props }) => props.className?.split(" ").includes("katex")
    ? <MathViewport><span {...props}>{children}</span></MathViewport>
    : <span {...props}>{children}</span>,
  img: ExternalImage,
});

const blockComponents = createComponents(false);
const inlineComponents = createComponents(true);

/** Safe Markdown/GFM renderer with LaTeX, tables, links and authenticated API images. */
export function RichText({ children, className, inline = false }: RichTextProps) {
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={cn("rich-text min-w-0 max-w-full leading-relaxed", inline ? "inline" : "academic-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkReadableMath, remarkBreaks]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, [rehypeKatex, { strict: "ignore" }]]}
        components={inline ? inlineComponents : blockComponents}
      >
        {children
          .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${math}$`)
          .replace(/\\\[([\s\S]*?)\\\]/g, (_, math: string) => `\n\n$$\n${math}\n$$\n\n`)}
      </ReactMarkdown>
    </Wrapper>
  );
}
