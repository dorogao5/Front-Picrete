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
      toast.error("Username должен содержать минимум 3 символа");
      return;
    }

    if (!pdConsent || !termsAccepted) {
      toast.error("Необходимо принять условия и согласие на обработку персональных данных");
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
      toast.success("Регистрация успешна");

      navigate(getDefaultAppPath(), { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ошибка регистрации"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-6 py-12">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Picrete" className="h-16 w-16 mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Регистрация
          </h1>
          <p className="text-muted-foreground mt-2">Создайте аккаунт Picrete</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Полное имя *</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Иванов Иван Иванович"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              type="text"
              placeholder="petrov_2026"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={64}
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite code (необязательно)</Label>
            <Input
              id="inviteCode"
              type="text"
              placeholder="CHEM-STUD-V1"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identityValue">Identity value (необязательно)</Label>
            <Input
              id="identityValue"
              type="text"
              placeholder="654321 или student@itmo.ru"
              value={identityValue}
              onChange={(e) => setIdentityValue(e.target.value)}
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль * (минимум 8 символов)</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Подтвердите пароль *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="transition-all duration-300 focus:shadow-soft"
            />
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/30">
            <div className="flex items-start space-x-3">
              <Checkbox id="pdConsent" checked={pdConsent} onCheckedChange={(v) => setPdConsent(Boolean(v))} />
              <Label htmlFor="pdConsent" className="leading-relaxed">
                Согласен(а) на обработку персональных данных в соответствии с{" "}
                <Link to="/consent" className="text-primary hover:underline">Согласием на обработку персональных данных</Link> и{" "}
                <Link to="/privacy" className="text-primary hover:underline">Политикой конфиденциальности</Link>.
              </Label>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="termsAccepted" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(Boolean(v))} />
              <Label htmlFor="termsAccepted" className="leading-relaxed">
                Принимаю условия{" "}
                <Link to="/terms" className="text-primary hover:underline">Пользовательского соглашения</Link>.
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Версия документов: {POLICY_VERSION}. Для работы сервиса необходимо принять условия.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || !pdConsent || !termsAccepted}
          >
            {loading ? "Регистрация..." : "Создать аккаунт"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Войти
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Назад на главную
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Signup;
