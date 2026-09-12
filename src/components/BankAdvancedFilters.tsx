import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { taskBankAPI } from "@/lib/api";

import { bankFacetLabel, bankFacetOptions, bankLabel, type BankFilters } from "@/lib/bankFilters";

interface Facets { paragraphs: string[]; topics: string[]; task_types: string[]; difficulties: string[]; volumes: string[] }
export function BankAdvancedFilters({ value, onChange, courseId, source, listPrefix, onTopics, sourceLabels = false }: {
  value: BankFilters; onChange: (value: BankFilters) => void; courseId: string; source: string; listPrefix: string; onTopics?: (topics: string[]) => void; sourceLabels?: boolean;
}) {
  const id = useId();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFacets(null);
    onTopics?.([]);
    setFailed(false);
    taskBankAPI.facets(courseId, source).then(({ data }) => {
      if (!cancelled) { setFacets(data); onTopics?.(data.topics); }
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [courseId, source, retry, onTopics]);
  const selectClass = "mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const groups = [
    { key: "task_type" as const, title: "Тип задания", options: facets?.task_types ?? [] },
    { key: "difficulty" as const, title: "Сложность", options: sourceLabels ? bankFacetOptions("difficulty", facets?.difficulties) : ["легкая", "средняя", "сложная"].filter(v => facets?.difficulties.includes(v)) },
    { key: "volume" as const, title: "Объём", options: sourceLabels ? bankFacetOptions("volume", facets?.volumes) : ["короткое", "среднее", "длинное"].filter(v => facets?.volumes.includes(v)) },
  ];
  return <div className="mt-4 space-y-3">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <div className="col-span-2 lg:col-span-1">
        <Label htmlFor={`${id}-q`}>Номер или текст задания</Label>
        <Input id={`${id}-q`} className="mt-1" type="search" placeholder="Например: 7.61 или энтальпия"
          value={value.q} onChange={e => onChange({ ...value, q: e.target.value })} />
      </div>
      {groups.map(group => <div key={group.key}>
        <Label htmlFor={`${id}-${group.key}`}>{group.title}</Label>
        <select id={`${id}-${group.key}`} className={selectClass} value={value[group.key]}
          onChange={e => onChange({ ...value, [group.key]: e.target.value })}>
          <option value="">Все</option>
          {group.options.map(option => <option key={option} value={option}>{sourceLabels ? bankFacetLabel(group.key, option) : bankLabel(option)}</option>)}
        </select>
      </div>)}
      <div>
        <Label htmlFor={`${id}-solution`}>Эталонное решение</Label>
        <select id={`${id}-solution`} className={selectClass} value={value.has_solution}
          onChange={e => onChange({ ...value, has_solution: e.target.value as BankFilters["has_solution"] })}>
          <option value="all">Все задания</option><option value="yes">С решением</option><option value="no">Без решения</option>
        </select>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">Тип, сложность и объём указаны по разметке источника. Задания без разметки видны при значении «Все».</p>
    {failed && <p role="status" className="text-sm text-destructive">Не удалось загрузить варианты фильтров. <button type="button" className="underline" onClick={() => setRetry(v => v + 1)}>Повторить</button></p>}
    <datalist id={`${listPrefix}-paragraphs`}>{facets?.paragraphs.slice().sort((a, b) => Number(a) - Number(b)).map(v => <option key={v} value={v} />)}</datalist>
  </div>;
}
