import { RichText } from "@/components/RichText";

/** Shared typography, safe Markdown/HTML and responsive math across review screens. */
export function renderLatex(text: string): React.ReactNode {
  return text ? <RichText inline className="academic-content">{text}</RichText> : text;
}

export function renderTaskText(text: string): React.ReactNode {
  return text ? <RichText>{text}</RichText> : text;
}
