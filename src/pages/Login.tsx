import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { authAPI, getApiErrorMessage, getApiErrorStatus } from "@/lib/api";
import { getDefaultAppPath, setAuthSession } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login({ username: username.trim(), password });
      const { access_token, user, memberships, active_course_id } = response.data;

      setAuthSession({
        access_token,
        user,
        memberships: memberships ?? [],
        active_course_id: active_course_id ?? null,
      });

      setLoading(false);
      toast.success("Вход выполнен");

      navigate(getDefaultAppPath(), { replace: true });
    } catch (error: unknown) {
      const message =
        getApiErrorStatus(error) === 401
          ? "Неверный логин или пароль"
          : getApiErrorMessage(error, "Не удалось войти");
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-notebook px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <div className="mt-10 max-w-xl">
            <img src={logo} alt="Picrete" className="h-12 w-12" />
            <h1 className="mt-6 text-5xl font-semibold leading-tight">С возвращением в лабораторию</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              После входа откроется активный курс: работы, банк задач, тренажеры и ревью загруженных решений.
            </p>
            <p className="mt-8 max-w-lg border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
              Курсы и роли сохраняются. Загруженные работы остаются в контексте курса. Сессия защищена
              токеном доступа.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>

          <Card className="p-6 shadow-elegant sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex items-center gap-3">
                <img src={logo} alt="Picrete" className="h-10 w-10" />
                <div>
                  <p className="text-sm text-muted-foreground">Picrete</p>
                  <h1 className="text-2xl font-semibold">Вход</h1>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                <ShieldCheck className="h-4 w-4" />
                Доступ к курсам и проверкам
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="petrov_2026"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={64}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? "Входим..." : "Войти"}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Link to="/signup" className="font-medium text-accent hover:underline">
                Создать аккаунт
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Login;
