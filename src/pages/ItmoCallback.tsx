import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "@/lib/api";
import { getDefaultAppPath, setAuthSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
export default function ItmoCallback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    // Remove the one-time provider code before rendering links or making API calls.
    window.history.replaceState({}, "", "/auth/itmo/callback");
    const stored = sessionStorage.getItem("itmo-login");
    sessionStorage.removeItem("itmo-login");
    const complete = async () => {
      try {
        if (params.has("error")) throw new Error("Вход отменён или ITMO.ID не предоставил доступ.");
        const binding = stored ? JSON.parse(stored) : null;
        const code = params.get("code");
        if (!binding || binding.state !== params.get("state") || !code) throw new Error("Сессия входа истекла. Начните вход заново в этой вкладке.");
        const { data } = await api.post<Parameters<typeof setAuthSession>[0]>("/auth/itmo/finish", { state: binding.state, binding: binding.binding, code });
        setAuthSession(data);
        navigate(getDefaultAppPath(), { replace: true });
      } catch (e) { setError(getApiErrorMessage(e, e instanceof Error ? e.message : "Не удалось войти через ITMO.ID")); }
    };
    void complete();
  }, [navigate]);
  return <main className="min-h-screen bg-notebook flex items-center justify-center p-6"><Card className="max-w-md p-6 space-y-4"><h1 className="text-xl font-semibold">Вход через ITMO.ID</h1><p role={error ? "alert" : "status"}>{error || "Проверяем данные и открываем ваши курсы…"}</p>{error && <Link to="/login" className="underline">Вернуться ко входу</Link>}</Card></main>;
}
