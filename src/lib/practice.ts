import { api } from "./api";
export const levels = [
  { id: "easy", label: "Базовый" },
  { id: "medium", label: "Средний" },
  { id: "hard", label: "Сложный" },
] as const;
export interface PoolItem {
  task_id: string;
  difficulty: string;
}
export interface Section {
  id: string;
  title: string;
  target: number;
  items: PoolItem[];
}
export interface Definition {
  title: string;
  description: string;
  sections: Section[];
}
export interface Trainer {
  id: string;
  source?: string;
  generation_unlock?: Record<string, boolean>;
  generation_progress?: Record<string, { solved: number; required: number }>;
  definition: Definition;
  published: boolean;
  revision: number;
  release_id: string | null;
  progress: {
    section_id: string;
    difficulty: string;
    solved: number;
    independent: number;
  }[];
}
export interface Check {
  feedback: string;
  total_score: number;
  max_score: number;
  unreadable: boolean;
  revision: number;
  criteria_scores: {
    criterion_name: string;
    score: number;
    max_score: number;
    comment: string;
  }[];
}
export interface Attempt {
  id: string;
  title: string;
  trainer_id: string | null;
  section_id: string | null;
  set_id: string | null;
  difficulty: string;
  preview: boolean;
  revision: number;
  draft: string;
  solved: boolean;
  helped: boolean;
  revealed: boolean;
  can_check: boolean;
  can_chat: boolean;
  task: {
    id: string;
    number: string;
    text: string;
    images: { id: string; full_url: string }[];
  };
  messages: { role: string; content: string; kind?: string }[];
  checks: Check[];
  photos: { id: string; filename: string; url: string }[];
  jobs: { id: string; kind: string; status: string; error: string | null }[];
}
export const base = (course: string) => `/courses/${course}/practice`;
export const practice = {
  catalog: async (course: string, manage = false) =>
    (
      await api.get<{ items: Trainer[] }>(`${base(course)}/catalog`, {
        params: { manage },
      })
    ).data.items,
  trainer: async (course: string, id: string, manage = false) =>
    (
      await api.get<Trainer>(`${base(course)}/catalog/${id}`, {
        params: { manage },
      })
    ).data,
  save: async (
    course: string,
    id: string | null,
    definition: Definition,
    revision?: number,
  ) =>
    (
      await (id ? api.put : api.post)(
        `${base(course)}/catalog${id ? `/${id}` : ""}`,
        { definition, revision },
      )
    ).data as { id: string; revision: number },
  publish: async (course: string, t: Trainer) =>
    api.post(`${base(course)}/catalog/${t.id}/publish`, {
      definition: t.definition,
      revision: t.revision,
    }),
  unpublish: async (course: string, id: string) =>
    api.post(`${base(course)}/catalog/${id}/unpublish`),
  start: async (
    course: string,
    source: {
      trainer_id?: string;
      section_id?: string;
      difficulty?: string;
      set_id?: string;
      task_id?: string;
      preview?: boolean;
      next?: boolean;
    },
  ) =>
    (
      await api.post<{ id: string }>(`${base(course)}/attempts`, {
        ...source,
        request_id: crypto.randomUUID(),
      })
    ).data.id,
  get: async (course: string, id: string) =>
    (await api.get<Attempt>(`${base(course)}/attempts/${id}`)).data,
  edit: async (course: string, a: Attempt, draft: string) =>
    (
      await api.put<{ revision: number }>(`${base(course)}/attempts/${a.id}`, {
        draft,
        revision: a.revision,
      })
    ).data,
  action: async (
    course: string,
    id: string,
    revision: number,
    kind: string,
    message = "",
  ) =>
    api.post(`${base(course)}/attempts/${id}/actions`, {
      revision,
      kind,
      message,
      request_id: crypto.randomUUID(),
    }),
  upload: async (course: string, id: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return api.post(`${base(course)}/attempts/${id}/photos`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
export function completion(t: Trainer) {
  let target = 0,
    done = 0;
  for (const s of t.definition.sections) {
    const primary = levels.find((l) =>
      s.items.some((i) => i.difficulty === l.id),
    )?.id;
    const count = s.items.filter((i) => i.difficulty === primary).length;
    const goal = Math.min(s.target, count);
    target += goal;
    done += Math.min(
      goal,
      t.progress.find((p) => p.section_id === s.id && p.difficulty === primary)
        ?.solved ?? 0,
    );
  }
  return {
    done,
    target,
    percent: target ? Math.round((done / target) * 100) : 0,
  };
}
