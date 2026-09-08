import { useItmoAvailability } from "@/hooks/useItmoAvailability";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ItmoLogin() {
  const { enabled } = useItmoAvailability();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;
  const start = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ authorization_url: string; state: string; binding: string }>("/auth/itmo/start", { consent });
      const target = new URL(data.authorization_url);
      const callback = new URL(target.searchParams.get("redirect_uri") || "");
      if (target.origin !== "https://id.itmo.ru" || callback.origin !== window.location.origin) {
        throw new Error("Для входа откройте Picrete по основному адресу https://picrete.com");
      }
      sessionStorage.setItem("itmo-login", JSON.stringify({ state: data.state, binding: data.binding }));
      window.location.assign(target.href);
    } catch (e) {
      toast.error(e instanceof Error && e.message.startsWith("Для входа") ? e.message : getApiErrorMessage(e, "Не удалось начать вход через ITMO.ID"));
      setBusy(false);
    }
  };
  return <div className="mb-6 space-y-3 rounded-lg border border-border p-4">
    <p className="font-medium">Студентам и преподавателям ИТМО</p>
    <p className="text-sm text-muted-foreground">Войдите через ITMO.ID. Ваши курсы откроются автоматически. Отдельная регистрация и пароль Picrete не нужны.</p>
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" />
      <span>Согласен на получение и обработку данных ITMO.ID согласно <Link className="underline" to="/consent" target="_blank">согласию</Link> и <Link className="underline" to="/privacy" target="_blank">политике конфиденциальности</Link>; принимаю <Link className="underline" to="/terms" target="_blank">условия использования</Link>.</span>
    </label>
    <Button className="w-full" type="button" disabled={!consent || busy} onClick={start}>{busy ? "Открываем ITMO.ID…" : "Войти через ITMO.ID"}</Button>
  </div>;
}
