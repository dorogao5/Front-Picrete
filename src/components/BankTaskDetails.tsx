import { RichText } from "@/components/RichText";
import { Badge } from "@/components/ui/badge";
import { bankFacetLabel, bankLabel } from "@/lib/bankFilters";
import type { TaskBankItem } from "@/lib/api";

export function BankTaskBadges({ item, sourceLabels = false }: { item: TaskBankItem; sourceLabels?: boolean }) {
  return <>
    {item.task_type && <Badge variant="outline">{sourceLabels ? bankFacetLabel("task_type", item.task_type) : bankLabel(item.task_type)}</Badge>}
    {item.difficulty && <Badge variant="outline">{sourceLabels ? `Сложность: ${bankFacetLabel("difficulty", item.difficulty)}` : bankLabel(item.difficulty)}</Badge>}
    {item.volume && <Badge variant="outline">{sourceLabels ? `Объём: ${bankFacetLabel("volume", item.volume)}` : bankLabel(item.volume)}</Badge>}
    {item.has_solution && <Badge variant="success">С решением</Badge>}
  </>;
}

export function BankTaskReference({ item }: { item: TaskBankItem }) {
  if (!item.answer && !item.solution) return null;
  return <div className="mt-4 space-y-3 border-t pt-3">
    {item.solution && <details className="rounded-md bg-muted/40 p-3">
      <summary className="cursor-pointer text-sm font-medium">Эталонное решение · № {item.number}</summary>
      <RichText className="mt-3 text-sm">{item.solution}</RichText>
    </details>}
    {item.answer && <details className="rounded-md bg-muted/40 p-3">
      <summary className="cursor-pointer text-sm font-medium">Краткий ответ · № {item.number}</summary>
      <RichText className="mt-3 text-sm">{item.answer}</RichText>
    </details>}
  </div>;
}
