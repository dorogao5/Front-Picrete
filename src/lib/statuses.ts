export type BadgeTone =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "accent"
  | "muted"
  | "outline";

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

const FALLBACK: StatusMeta = { label: "—", tone: "muted" };

export const submissionStatusMeta: Record<string, StatusMeta> = {
  uploaded: { label: "Загружена", tone: "info" },
  processing: { label: "Обрабатывается", tone: "warning" },
  preliminary: { label: "Предварительная оценка", tone: "accent" },
  approved: { label: "Проверена", tone: "success" },
  flagged: { label: "Требует внимания", tone: "warning" },
  rejected: { label: "Отклонена", tone: "destructive" },
};

export const ocrStatusMeta: Record<string, StatusMeta> = {
  not_required: { label: "OCR не требуется", tone: "muted" },
  pending: { label: "OCR в очереди", tone: "muted" },
  processing: { label: "Распознаётся", tone: "warning" },
  in_review: { label: "Ждёт проверки студентом", tone: "info" },
  validated: { label: "OCR подтверждён", tone: "success" },
  reported: { label: "OCR с замечаниями", tone: "warning" },
  failed: { label: "Ошибка OCR", tone: "destructive" },
};

export const llmStatusMeta: Record<string, StatusMeta> = {
  skipped: { label: "AI-проверка отключена", tone: "muted" },
  queued: { label: "AI в очереди", tone: "muted" },
  processing: { label: "AI проверяет", tone: "warning" },
  completed: { label: "AI-проверка готова", tone: "success" },
  failed: { label: "Ошибка AI", tone: "destructive" },
};

export const examStatusMeta: Record<string, StatusMeta> = {
  draft: { label: "Черновик", tone: "muted" },
  published: { label: "Опубликована", tone: "info" },
  active: { label: "Идёт", tone: "success" },
  completed: { label: "Завершена", tone: "secondary" },
  archived: { label: "В архиве", tone: "muted" },
};

export const sessionStatusMeta: Record<string, StatusMeta> = {
  active: { label: "В работе", tone: "success" },
  submitted: { label: "Сдана", tone: "info" },
  expired: { label: "Время вышло", tone: "warning" },
  graded: { label: "Оценена", tone: "success" },
};

export const pageStatusMeta: Record<string, StatusMeta> = {
  approved: { label: "Подтверждена", tone: "success" },
  reported: { label: "С замечаниями", tone: "warning" },
  not_reviewed: { label: "Не проверена", tone: "muted" },
};

export const severityMeta: Record<string, StatusMeta> = {
  minor: { label: "Мелкая", tone: "muted" },
  major: { label: "Существенная", tone: "warning" },
  critical: { label: "Критичная", tone: "destructive" },
};

export const workKindMeta: Record<string, StatusMeta> = {
  control: { label: "Контрольная", tone: "accent" },
  homework: { label: "Домашняя", tone: "info" },
};

export type StatusDomain =
  | "submission"
  | "ocr"
  | "llm"
  | "exam"
  | "session"
  | "page"
  | "severity"
  | "workKind";

const domainMaps: Record<StatusDomain, Record<string, StatusMeta>> = {
  submission: submissionStatusMeta,
  ocr: ocrStatusMeta,
  llm: llmStatusMeta,
  exam: examStatusMeta,
  session: sessionStatusMeta,
  page: pageStatusMeta,
  severity: severityMeta,
  workKind: workKindMeta,
};

export const statusMeta = (domain: StatusDomain, value?: string | null): StatusMeta => {
  if (!value) return FALLBACK;
  return domainMaps[domain][value] ?? { label: value, tone: "muted" };
};
