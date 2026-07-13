import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { useParams } from "react-router-dom";

import { PageLoader, PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AssistantChatMessage,
  AssistantChatThread,
  AssistantChatThreadSummary,
  CourseAssistantStatus,
  courseAssistantAPI,
  getApiErrorMessage,
  getApiErrorStatus,
} from "@/lib/api";
import { renderLatex } from "@/lib/renderLatex";
import { hasCourseRole, isAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

function MessageContent({ content }: { content: string }) {
  const blockMathRegex = /(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g;
  const chunks = content.split(blockMathRegex);

  return (
    <div className="space-y-1.5 text-sm leading-6">
      {chunks.map((chunk, chunkIndex) => {
        if (!chunk) return null;
        if ((chunk.startsWith("\\[") && chunk.endsWith("\\]")) || (chunk.startsWith("$$") && chunk.endsWith("$$"))) {
          return (
            <div key={`math-${chunkIndex}`} className="latex-scroll min-w-0 max-w-full">
              {renderLatex(chunk)}
            </div>
          );
        }

        return chunk.split("\n").map((line, lineIndex) => {
          const key = `text-${chunkIndex}-${lineIndex}`;
          const trimmed = line.trim();
          if (!trimmed) return <div key={key} className="h-1" />;
          if (/^#{1,3}\s/.test(trimmed)) {
            return (
              <p key={key} className="pt-1 font-semibold">
                {renderMessageInline(trimmed.replace(/^#{1,3}\s+/, ""))}
              </p>
            );
          }
          if (/^[-*]\s/.test(trimmed)) {
            return (
              <p key={key} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">
                {renderMessageInline(trimmed.slice(2))}
              </p>
            );
          }
          return <p key={key}>{renderMessageInline(line)}</p>;
        });
      })}
    </div>
  );
}

function renderMessageInline(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`strong-${index}`}>{renderLatex(part.slice(2, -2))}</strong>;
    }
    return <span key={`inline-${index}`}>{renderLatex(part)}</span>;
  });
}

function ChatMessage({ message }: { message: AssistantChatMessage }) {
  const fromUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", fromUser && "justify-end")}>
      {!fromUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[min(46rem,88%)] rounded-2xl px-4 py-3",
          fromUser
            ? "rounded-br-md bg-foreground text-background"
            : "rounded-bl-md border bg-card",
        )}
      >
        <MessageContent content={message.content} />
      </div>
      {fromUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export default function CourseAssistant() {
  const { courseId } = useParams<{ courseId: string }>();
  const [status, setStatus] = useState<CourseAssistantStatus | null>(null);
  const [threads, setThreads] = useState<AssistantChatThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<AssistantChatThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const renderedThreadIdRef = useRef<string | null>(null);
  const canConfigureAssistant = isAdmin() || (courseId ? hasCourseRole(courseId, "teacher") : false);
  const activeThreadIsStale = Boolean(
    activeThread &&
      status?.snapshot_version &&
      activeThread.snapshot_version !== status.snapshot_version,
  );

  useEffect(() => {
    if (!courseId) return;
    Promise.all([courseAssistantAPI.status(courseId), courseAssistantAPI.threads(courseId)])
      .then(async ([statusResponse, threadsResponse]) => {
        setStatus(statusResponse.data);
        setThreads(threadsResponse.data);
        const latest = threadsResponse.data[0];
        if (latest) {
          setThreadLoading(true);
          try {
            setActiveThread((await courseAssistantAPI.thread(latest.id, courseId)).data);
          } finally {
            setThreadLoading(false);
          }
        }
      })
      .catch((reason) => setError(getApiErrorMessage(reason, "Не удалось открыть ассистента")))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    const threadId = activeThread?.id ?? null;
    const threadWasAlreadyOpen = threadId !== null && renderedThreadIdRef.current === threadId;
    renderedThreadIdRef.current = threadId;
    if (threadWasAlreadyOpen || sending) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeThread?.id, activeThread?.messages.length, sending]);

  const startNewDialog = () => {
    setActiveThread(null);
    setError("");
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = message.trim();
    if (!courseId || !value || sending || activeThreadIsStale) return;
    setSending(true);
    setError("");
    try {
      const response = await courseAssistantAPI.chat(
        { thread_id: activeThread?.id, message: value },
        courseId,
      );
      setMessage("");
      setThreads((current) => [
        {
          id: response.data.id,
          title: response.data.title,
          snapshot_version: response.data.snapshot_version,
          created_at: response.data.created_at,
          updated_at: response.data.updated_at,
        },
        ...current.filter((item) => item.id !== response.data.id),
      ]);
      setActiveThread(response.data);
    } catch (reason) {
      if (getApiErrorStatus(reason) === 409) {
        try {
          setStatus((await courseAssistantAPI.status(courseId)).data);
          setError("");
        } catch {
          setError(getApiErrorMessage(reason, "Ассистент курса обновился. Начните новый диалог."));
        }
      } else {
        setError(getApiErrorMessage(reason, "Ассистент не смог ответить — попробуйте ещё раз"));
      }
    } finally {
      setSending(false);
    }
  };

  const selectThread = async (threadId: string) => {
    if (!courseId || threadId === activeThread?.id || threadLoading) return;
    setThreadLoading(true);
    setError("");
    try {
      setActiveThread((await courseAssistantAPI.thread(threadId, courseId)).data);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Не удалось загрузить диалог"));
    } finally {
      setThreadLoading(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  if (!courseId) return null;
  if (loading) {
    return (
      <PageShell>
        <PageLoader label="Открываем ассистента…" />
      </PageShell>
    );
  }

  if (!status && error) {
    return (
      <PageShell title="Ассистент курса" subtitle="Разбор задач и обратная связь по материалам преподавателя">
        <Card className="mx-auto max-w-2xl p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Не удалось открыть ассистента</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{error}</p>
          <Button className="mt-5 gap-2" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> Повторить
          </Button>
        </Card>
      </PageShell>
    );
  }

  if (!status?.available) {
    return (
      <PageShell
        title="Ассистент курса"
        subtitle="Разбор задач и обратная связь по материалам преподавателя"
      >
        <Card className="mx-auto max-w-2xl p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-semibold">Ассистент ещё не опубликован</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {canConfigureAssistant
              ? "Подготовьте и протестируйте ассистента в Picrete Studio, затем опубликуйте его в этот курс."
              : "Преподаватель курса ещё готовит ассистента. Он появится здесь после публикации."}
          </p>
          {canConfigureAssistant && (
            <Button asChild variant="accent" className="mt-5 gap-2">
              <a href="https://dev.picrete.com" target="_blank" rel="noreferrer">
                Открыть Picrete Studio
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={status.name ?? "Ассистент курса"}
      subtitle={`${status.discipline ?? "Материалы курса"} · ответы сохраняются в истории`}
      width="wide"
    >
      <div className="grid gap-4 lg:h-[calc(100vh-13rem)] lg:min-h-[36rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={startNewDialog}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Новый диалог
          </Button>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={cn(
                  "min-w-56 rounded-lg px-3 py-2.5 text-left text-sm transition-colors lg:w-full lg:min-w-0",
                  thread.id === activeThread?.id
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                onClick={() => void selectThread(thread.id)}
              >
                <span className="block truncate">{thread.title}</span>
                <span className="mt-0.5 block text-xs opacity-70">
                  {new Date(thread.updated_at).toLocaleDateString("ru-RU")}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <Card className="flex min-w-0 flex-col lg:h-auto lg:min-h-0 lg:overflow-hidden">
          <div className="space-y-5 p-4 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-live="polite">
            {!activeThread && !threadLoading && (
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Bot className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">С чего начнём?</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Пришлите условие, свой ход решения или укажите место, которое осталось
                  непонятным. Ассистент опирается на материалы этого курса.
                </p>
              </div>
            )}
            {threadLoading && (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Загружаем диалог…
              </div>
            )}
            {activeThread?.messages.map((item, index) => (
              <ChatMessage key={`${activeThread.id}-${index}`} message={item} />
            ))}
            {sending && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                Разбираю вопрос…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {activeThreadIsStale && (
            <div
              className="border-t border-border bg-muted/40 px-4 py-3 sm:px-6"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Ассистент курса обновился</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    Эта история сохранена для справки. Продолжите работу в новом диалоге с актуальными
                    промптом и материалами курса.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={startNewDialog}
                >
                  <MessageSquarePlus className="h-4 w-4" /> Новый диалог
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="border-t bg-background/80 p-3 sm:p-4">
            {error && (
              <p className="mb-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={onKeyDown}
                maxLength={4000}
                rows={2}
                placeholder={
                  activeThreadIsStale
                    ? "Начните новый диалог, чтобы продолжить…"
                    : "Опишите вопрос или вставьте своё решение…"
                }
                aria-label="Сообщение ассистенту"
                className="min-h-[3.25rem] max-h-40 resize-none text-base sm:text-sm"
                disabled={sending || activeThreadIsStale}
              />
              <Button
                type="submit"
                variant="accent"
                size="icon"
                className="h-12 w-12 shrink-0"
                disabled={!message.trim() || sending || activeThreadIsStale}
                aria-label="Отправить"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Enter — отправить, Shift+Enter — новая строка
            </p>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
