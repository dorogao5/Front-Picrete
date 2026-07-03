import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import logo from "@/assets/logo.png";
import { authAPI, getApiErrorMessage } from "@/lib/api";
import { getDefaultAppPath, setAuthSession } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";

const POLICY_VERSION = "2025-12-09";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [identityValue, setIdentityValue] = useState("");
  const [pdConsent, setPdConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    if (password.length < 8) {
      toast.error("Пароль должен быть не менее 8 символов");
      return;
    }

    if (username.trim().length < 3) {
      toast.error("Логин должен содержать минимум 3 символа");
      return;
    }

    if (!pdConsent || !termsAccepted) {
      toast.error("Примите соглашение и согласие на обработку данных");
      return;
    }

    setLoading(true);
    try {
      const normalizedIdentity = identityValue.trim();
      let identityPayload: Record<string, string> = {};
      if (normalizedIdentity) {
        if (/^\d{6}$/.test(normalizedIdentity)) {
          identityPayload = { isu: normalizedIdentity };
        } else if (normalizedIdentity.includes("@")) {
          identityPayload = { email: normalizedIdentity };
        } else {
          identityPayload = { text: normalizedIdentity };
        }
      }

      const response = await authAPI.signup({
        username: username.trim(),
        full_name: fullName,
        password,
        invite_code: inviteCode.trim() || undefined,
        identity_payload: identityPayload,
        pd_consent: true,
        pd_consent_version: POLICY_VERSION,
        terms_version: POLICY_VERSION,
        privacy_version: POLICY_VERSION,
      });

      const { access_token, user, memberships, active_course_id } = response.data;

      setAuthSession({
        access_token,
        user,
        memberships: memberships ?? [],
        active_course_id: active_course_id ?? null,
      });

      setLoading(false);
      toast.success("Аккаунт создан");

      navigate(getDefaultAppPath(), { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось создать аккаунт"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-notebook px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
          <div className="mt-10 max-w-lg">
            <img src={logo} alt="Picrete" className="h-12 w-12" />
            <h1 className="mt-6 text-5xl font-semibold leading-tight">Аккаунт для курса</h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Регистрация привязывает пользователя к курсам, ролям и проверкам. Код курса можно добавить сразу
              или позже в личном кабинете.
            </p>
            <p className="mt-8 max-w-lg border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
              ФИО нужно преподавателю для ведомости. ИСУ или email помогает подтвердить участника.
              Согласия нужны для работы с загруженными решениями.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-2xl">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>

          <Card className="p-5 shadow-elegant sm:p-7">
            <div className="mb-7 flex items-center gap-3">
              <img src={logo} alt="Picrete" className="h-10 w-10" />
              <div>
                <p className="text-sm text-muted-foreground">Picrete</p>
                <h1 className="text-2xl font-semibold">Создать аккаунт</h1>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName">ФИО</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Иванов Иван Иванович"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>

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
                  <Label htmlFor="identityValue">ИСУ или email</Label>
                  <Input
                    id="identityValue"
                    type="text"
                    placeholder="123456 или name@example.com"
                    value={identityValue}
                    onChange={(e) => setIdentityValue(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inviteCode">Код курса</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="CHEM-STUD-V1"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Если кода нет, аккаунт можно создать и присоединиться позже.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Не менее 8 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Повторите пароль</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Еще раз"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-md border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="pdConsent" checked={pdConsent} onCheckedChange={(v) => setPdConsent(Boolean(v))} />
                  <Label htmlFor="pdConsent" className="min-w-0 text-sm leading-6">
                    Согласен(а) на обработку персональных данных по{" "}
                    <Link to="/consent" className="font-medium text-accent hover:underline">согласию</Link>{" "}
                    и{" "}
                    <Link to="/privacy" className="font-medium text-accent hover:underline">политике конфиденциальности</Link>.
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(Boolean(v))} />
                  <Label htmlFor="termsAccepted" className="min-w-0 text-sm leading-6">
                    Принимаю{" "}
                    <Link to="/terms" className="font-medium text-accent hover:underline">пользовательское соглашение</Link>.
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">Версия документов: {POLICY_VERSION}</p>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || !pdConsent || !termsAccepted}
              >
                <UserPlus className="h-4 w-4" />
                {loading ? "Создаем..." : "Создать аккаунт"}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="font-medium text-accent hover:underline">
                Войти
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Signup;
