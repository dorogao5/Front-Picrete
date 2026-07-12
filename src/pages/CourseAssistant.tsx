import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquarePlus, Send, UserRound } from "lucide-react";
import { useParams } from "react-router-dom";

import { PageLoader, PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AssistantChatMessage,
  AssistantChatThread,
  CourseAssistantStatus,
  courseAssistantAPI,
  getApiErrorMessage,
} from "@/lib/api";
import { renderLatex } from "@/lib/renderLatex";
import { cn } from "@/lib/utils";

function MessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-6">
      {content.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (/^#{1,3}\s/.test(trimmed)) {
          return (
            <p key={index} className="pt-1 font-semibold">
              {renderLatex(trimmed.replace(/^#{1,3}\s+/, ""))}
            </p>
          );
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <p key={index} className="pl-4 before:-ml-4 before:mr-2 before:content-['•']">
              {renderLatex(trimmed.slice(2))}
            </p>
          );
        }
        return <p key={index}>{renderLatex(line)}</p>;
      })}
    </div>
  );
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
  const [threads, setThreads] = useState<AssistantChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((thread) => thread.id === activeId) ?? null;

  useEffect(() => {
    if (!courseId) return;
    Promise.all([courseAssistantAPI.status(courseId), courseAssistantAPI.threads(courseId)])
      .then(([statusResponse, threadsResponse]) => {
        setStatus(statusResponse.data);
        setThreads(threadsResponse.data);
        setActiveId(threadsResponse.data[0]?.id ?? null);
      })
      .catch((reason) => setError(getApiErrorMessage(reason, "Не удалось открыть ассистента")))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeThread?.messages.length, sending]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = message.trim();
    if (!courseId || !value || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await courseAssistantAPI.chat(
        { thread_id: activeThread?.id, message: value },
        courseId,
      );
      setMessage("");
      setThreads((current) => [
        response.data,
        ...current.filter((item) => item.id !== response.data.id),
      ]);
      setActiveId(response.data.id);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Ассистент не смог ответить — попробуйте ещё раз"));
    } finally {
      setSending(false);
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
            Преподаватель сможет подготовить и протестировать его в Picrete Studio, затем
            опубликовать в этот курс.
          </p>
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
            onClick={() => setActiveId(null)}
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
                  thread.id === activeId
                    ? "bg-muted font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                onClick={() => setActiveId(thread.id)}
              >
                <span className="block truncate">{thread.title}</span>
                <span className="mt-0.5 block text-xs opacity-70">
                  {new Date(thread.updated_at).toLocaleDateString("ru-RU")}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <Card className="flex h-[calc(100dvh-5rem)] min-h-[32rem] min-w-0 flex-col overflow-hidden lg:h-auto lg:min-h-0">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {!activeThread && (
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
                placeholder="Опишите вопрос или вставьте своё решение…"
                aria-label="Сообщение ассистенту"
                className="min-h-[3.25rem] max-h-40 resize-none"
                disabled={sending}
              />
              <Button
                type="submit"
                variant="accent"
                size="icon"
                className="h-12 w-12 shrink-0"
                disabled={!message.trim() || sending}
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
