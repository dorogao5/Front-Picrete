import { useEffect, useRef } from "react";
import { EditorState, StateField, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  showTooltip,
  type Tooltip,
  WidgetType,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import katex from "katex";

import { cn } from "@/lib/utils";

/*
  Obsidian-подобный live-редактор OCR-текста: формулы $...$ / $$...$$ рендерятся
  прямо в тексте; клик по формуле раскрывает её исходник, над ним плавает
  живой предпросмотр. Остальной текст редактируется как обычный.
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

const buildDecorations = (state: EditorState): DecorationSet => {
  const selection = state.selection.main;
  const decorations: Range<Decoration>[] = [];
  for (const span of findMathSpans(state.doc.toString())) {
    const isActive = selection.from <= span.to && selection.to >= span.from;
    if (isActive) continue;
    decorations.push(
      Decoration.replace({ widget: new MathWidget(span.latex, span.display, span.from) }).range(
        span.from,
        span.to
      )
    );
  }
  return Decoration.set(decorations, true);
};

const mathDecorations = StateField.define<DecorationSet>({
  create: buildDecorations,
  update: (_deco, tr) => buildDecorations(tr.state),
  provide: (field) => EditorView.decorations.from(field),
});

/* Плавающий предпросмотр редактируемой формулы (как в Obsidian) */
const previewTooltip = (state: EditorState): Tooltip | null => {
  const span = activeSpan(state);
  if (!span) return null;
  const text = state.doc.sliceString(span.from, span.to);
  const inner = text.replace(/^\$\$?|\$\$?$/g, "").trim();
  if (!inner) return null;
  return {
    pos: span.from,
    above: true,
    strictSide: false,
    create: () => {
      const dom = document.createElement("div");
      dom.className = "cm-math-preview";
      renderKatex(dom, inner, span.display);
      return { dom };
    },
  };
};

const mathPreview = StateField.define<Tooltip | null>({
  create: previewTooltip,
  update: (_tip, tr) => previewTooltip(tr.state),
  provide: (field) => showTooltip.from(field),
});

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
          mathPreview,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
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

  return <div ref={containerRef} className={cn("math-live-editor", className)} />;
};
