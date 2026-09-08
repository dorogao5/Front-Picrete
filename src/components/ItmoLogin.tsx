import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ItmoLogin({ linkAccount = false }: { linkAccount?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api.get<{ enabled: boolean }>("/auth/itmo/config").then(r => { if (active) setEnabled(r.data.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ authorization_url: string; state: string; binding: string }>(`/auth/itmo/${linkAccount ? "link" : "start"}`, { consent });
      const target = new URL(data.authorization_url);
      const callback = new URL(target.searchParams.get("redirect_uri") || "");
      if (target.origin !== "https://id.itmo.ru" || callback.origin !== window.location.origin) {
        throw new Error("Для входа откройте Picrete по основному адресу https://picrete.ru");
      }
      sessionStorage.setItem("itmo-login", JSON.stringify({ state: data.state, binding: data.binding }));
      window.location.assign(target.href);
    } catch (e) {
      toast.error(e instanceof Error && e.message.startsWith("Для входа") ? e.message : getApiErrorMessage(e, "Не удалось начать вход через ITMO.ID"));
      setBusy(false);
    }
  };
  return <div className="mb-6 space-y-3 rounded-lg border border-border p-4">
    <p className="font-medium">{linkAccount ? "Связать аккаунт с ITMO.ID" : "Студентам и преподавателям ИТМО"}</p>
    <p className="text-sm text-muted-foreground">ФИО поступит из ИТМО. Студенты получат доступ к учебным курсам по группе и году обучения; преподавателям доступ назначает администратор курса.</p>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
      <span>Согласен на получение и обработку данных ITMO.ID согласно <Link className="underline" to="/consent" target="_blank">согласию</Link> и <Link className="underline" to="/privacy" target="_blank">политике конфиденциальности</Link>; принимаю <Link className="underline" to="/terms" target="_blank">условия использования</Link>.</span>
    </label>
    <Button className="w-full" type="button" disabled={!consent || busy} onClick={start}>{busy ? "Открываем ITMO.ID…" : linkAccount ? "Связать с ITMO.ID" : "Войти через ITMO.ID"}</Button>
    {!linkAccount && <p className="text-xs text-muted-foreground">Уже есть аккаунт Picrete? Войдите по логину и свяжите его с ITMO.ID в разделе «Мои курсы», чтобы сохранить работы.</p>}
  </div>;
}
