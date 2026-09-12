import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Trash2 } from "lucide-react";
import { PageShell, PageLoader } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/RichText";
import { InlineError } from "@/components/InlineError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trainerAPI, getApiErrorMessage, type TrainerSet } from "@/lib/api";
import { practice } from "@/lib/practice";
export default function TrainerSetView() {
  const { courseId = "", setId = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<TrainerSet | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [remove, setRemove] = useState(false);
  const load = useCallback(async () => {
    try {
      setError("");
      setData((await trainerAPI.getSet(setId, courseId)).data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось загрузить набор"));
    }
  }, [courseId, setId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function start(task: string) {
    setBusy(task);
    try {
      const id = await practice.start(courseId, {
        set_id: setId,
        task_id: task,
      });
      navigate(`/c/${courseId}/trainer/practice/${id}`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось открыть задачу"));
    } finally {
      setBusy("");
    }
  }
  async function destroy() {
    setBusy("delete");
    try {
      await trainerAPI.deleteSet(setId, courseId);
      navigate(`/c/${courseId}/trainer`);
    } catch (e) {
      setError(getApiErrorMessage(e, "Не удалось удалить набор"));
    } finally {
      setBusy("");
      setRemove(false);
    }
  }
  return (
    <PageShell
      title={data?.title ?? "Личный набор"}
      subtitle={
        data ? `${data.items.length} задач · ${data.source_title}` : undefined
      }
      backLabel="Все тренажёры"
      onBack={() => navigate(`/c/${courseId}/trainer`)}
      actions={
        <Button variant="ghost" onClick={() => setRemove(true)}>
          <Trash2 className="h-4 w-4" />
          Удалить набор
        </Button>
      }
    >
      {error && (
        <InlineError
          title="Не удалось выполнить действие"
          description={error}
          onRetry={load}
        />
      )}{" "}
      {!data && !error ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          {data?.items.map((t, index) => (
            <Card key={t.id} className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  {index + 1} · № {t.number}
                </span>
                <Button
                  variant="accent"
                  disabled={!!busy}
                  onClick={() => start(t.id)}
                >
                  <Play className="h-4 w-4" />
                  {busy === t.id ? "Открываем…" : "Решать с ИИ"}
                </Button>
              </div>
              <RichText className="text-base">{t.text}</RichText>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={remove} onOpenChange={setRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить личный набор?</DialogTitle>
            <DialogDescription>
              Он исчезнет из списка. Задачи банка и сохранённые попытки
              останутся.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemove(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={!!busy} onClick={destroy}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
