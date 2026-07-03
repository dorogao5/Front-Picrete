import { useEffect, useRef, useState } from "react";
import { EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import katex from "katex";

import { cn } from "@/lib/utils";

/*
  Obsidian-подобный live-редактор OCR-текста: формулы $...$ / $$...$$ рендерятся
  прямо в тексте; клик по формуле раскрывает её исходник (подсвеченной зоной),
  а над редактором появляется закреплённая полоса живого предпросмотра.
*/

interface MathSpan {
  from: number;
  to: number;
  latex: string;
  display: boolean;
}

const findMathSpans = (text: string): MathSpan[] => {
  const spans: MathSpan[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const display = match[1] !== undefined;
    const latex = (display ? match[1] : match[2]).trim();
    if (!latex) continue;
    spans.push({ from: match.index, to: match.index + match[0].length, latex, display });
  }
  return spans;
};

const renderKatex = (element: HTMLElement, latex: string, display: boolean) => {
  try {
    katex.render(latex, element, { throwOnError: false, displayMode: display });
  } catch {
    element.textContent = latex;
  }
};

class MathWidget extends WidgetType {
  constructor(
    readonly latex: string,
    readonly display: boolean,
    readonly from: number
  ) {
    super();
  }

  eq(other: MathWidget) {
    return other.latex === this.latex && other.display === this.display && other.from === this.from;
  }

  toDOM(view: EditorView) {
    const element = document.createElement(this.display ? "div" : "span");
    element.className = this.display ? "cm-math-widget cm-math-block" : "cm-math-widget";
    element.title = "Нажмите, чтобы отредактировать формулу";
    renderKatex(element, this.latex, this.display);
    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.from + (this.display ? 2 : 1) } });
      view.focus();
    });
    return element;
  }

  ignoreEvent() {
    return true;
  }
}

const activeSpan = (state: EditorState): MathSpan | null => {
  const selection = state.selection.main;
  for (const span of findMathSpans(state.doc.toString())) {
    if (selection.from <= span.to && selection.to >= span.from) {
      return span;
    }
  }
  return null;
};

const buildDecorations = (state: EditorState, hasFocus: boolean): DecorationSet => {
  const selection = state.selection.main;
  const decorations: Range<Decoration>[] = [];
  for (const span of findMathSpans(state.doc.toString())) {
    const isActive = hasFocus && selection.from <= span.to && selection.to >= span.from;
    if (isActive) {
      // Раскрытый исходник формулы — подсвеченная зона редактирования
      decorations.push(Decoration.mark({ class: "cm-math-active" }).range(span.from, span.to));
    } else {
      decorations.push(
        Decoration.replace({ widget: new MathWidget(span.latex, span.display, span.from) }).range(
          span.from,
          span.to
        )
      );
    }
  }
  return Decoration.set(decorations, true);
};

/* ViewPlugin вместо StateField: декорации зависят и от фокуса —
   клик мимо редактора сворачивает раскрытую формулу обратно в рендер */
const mathDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state, view.hasFocus);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.state, update.view.hasFocus);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);

interface MathLiveEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const MathLiveEditor = ({ value, onChange, placeholder, className }: MathLiveEditorProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [activeLatex, setActiveLatex] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          cmPlaceholder(placeholder ?? ""),
          mathDecorations,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet || update.focusChanged) {
              const span = update.view.hasFocus ? activeSpan(update.state) : null;
              setActiveLatex(span && span.latex ? span.latex : null);
            }
          }),
          EditorView.contentAttributes.of({ spellcheck: "false" }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  // Вывод KaTeX безопасен для innerHTML: без опции trust команды вроде \href отключены,
  // а входной LaTeX экранируется — сырой HTML из текста студента сюда не попадает.
  let previewHtml = "";
  if (activeLatex) {
    try {
      previewHtml = katex.renderToString(activeLatex, { throwOnError: false, displayMode: false });
    } catch {
      previewHtml = "";
    }
  }

  return (
    <div
      className={cn(
        "math-live-editor overflow-hidden rounded-md border border-input bg-card",
        className
      )}
    >
      {activeLatex && (
        <div className="border-b bg-secondary/50 px-3 py-1.5">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Предпросмотр формулы
          </p>
          <div
            className="overflow-x-auto py-0.5 text-sm [scrollbar-width:thin]"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
};
