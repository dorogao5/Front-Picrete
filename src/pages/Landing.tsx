import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import {
  ArrowRight,
  Beaker,
  Bot,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  ScanText,
  ShieldCheck,
  Upload,
} from "lucide-react";

const workflow = [
  { label: "Загрузка", value: "фото или PDF", icon: Upload },
  { label: "OCR", value: "формулы и рукописный текст", icon: ScanText },
  { label: "Проверка", value: "баллы по критериям", icon: ClipboardCheck },
  { label: "Ревью", value: "решение остается за преподавателем", icon: GraduationCap },
];

const features = [
  {
    title: "Для реальных работ по химии",
    text: "Поддерживаются контрольные и домашние, варианты, критерии, максимальные баллы и предметные комментарии.",
    icon: Beaker,
  },
  {
    title: "OCR без ручной перепечатки",
    text: "Студент загружает снимки работы, система собирает распознанный текст и оставляет спорные места на проверку.",
    icon: ScanText,
  },
  {
    title: "Препроверка LLM, финал за человеком",
    text: "Модель предлагает оценку и пояснение, преподаватель подтверждает, корректирует или отправляет на доработку.",
    icon: Bot,
  },
];

const roles = [
  {
    title: "Студент",
    items: ["видит свои работы и сроки", "загружает решения с телефона", "получает результат и комментарии"],
  },
  {
    title: "Преподаватель",
    items: ["создает работы и варианты", "смотрит OCR и AI-разбор", "утверждает итоговые баллы"],
  },
  {
    title: "Курс",
    items: ["единый банк задач", "права доступа по участникам", "история решений и проверок"],
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <section className="border-b border-border/70 bg-notebook px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28">
          <div className="container mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-muted-foreground">
                Платформа проверки работ по химии
              </p>

              <h1 className="mt-6 text-5xl font-semibold leading-[0.96] text-foreground sm:text-6xl lg:text-7xl">
                Picrete
              </h1>
              <p className="mt-5 max-w-2xl text-xl font-medium leading-snug text-foreground sm:text-2xl">
                Проверка контрольных и домашних без ручного разбора каждой фотографии.
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Сервис собирает работу студента, распознает решение, готовит проверку по критериям и
                оставляет преподавателю понятное место для финального решения.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup">
                  <Button size="lg" variant="accent" className="w-full sm:w-auto">
                    Создать аккаунт
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Посмотреть демо
                  </Button>
                </Link>
              </div>

              <div className="mt-8 max-w-2xl border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
                OCR рукописных решений, AI-разбор по рубрике, ревью преподавателя.
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-elegant sm:p-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Работа 10Б</p>
                  <p className="font-semibold">Растворы и стехиометрия</p>
                </div>
                <div className="rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                  Проверка
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {workflow.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-md border border-border bg-background p-4">
                    <Icon className="h-5 w-5 text-accent" />
                    <p className="mt-3 text-sm font-semibold">{label}</p>
                    <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-md border border-border bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 text-accent" />
                  <div className="min-w-0">
                    <p className="font-medium">Комментарий к критерию</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Уравнение записано верно, но коэффициент перед H2O потерян при расчете массы.
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-secondary">
                  <div className="h-2 w-[78%] rounded-full bg-accent" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>7.8 / 10</span>
                  <span>ожидает утверждения</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="container mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">Как это работает</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                От фото решения до оценки в ведомости
              </h2>
              <p className="mt-3 text-muted-foreground">
                Интерфейс построен вокруг курса, варианта, загруженной работы, критериев и финального решения.
              </p>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {features.map(({ title, text, icon: Icon }) => (
                <div key={title} className="border-t border-border pt-5">
                  <div className="text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-snug">{title}</h3>
                  <p className="mt-3 leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card px-4 py-12 sm:px-6 sm:py-16">
          <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">Роли без лишних экранов</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                Сайт одинаково удобен с компьютера и телефона
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                На компьютере удобно проверять и сравнивать работы. С телефона удобно войти, выбрать курс,
                загрузить фото и посмотреть результат.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {roles.map((role) => (
                <div key={role.title} className="border-t border-border pt-5">
                  <h3 className="font-semibold">{role.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{role.items.join(". ")}.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="container mx-auto max-w-6xl">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-5">
                <Clock className="h-5 w-5 text-accent" />
                <p className="mt-4 text-2xl font-semibold">меньше рутины</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  OCR и первичный разбор снимают самую медленную часть проверки.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <ShieldCheck className="h-5 w-5 text-accent" />
                <p className="mt-4 text-2xl font-semibold">контроль доступа</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Курсы, роли и приглашения не смешивают студентов и преподавателей.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5">
                <GraduationCap className="h-5 w-5 text-accent" />
                <p className="mt-4 text-2xl font-semibold">понятная обратная связь</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Итоговый балл сопровождается комментарием, а не только числом.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-lg border border-border bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:p-7">
              <div>
                <h2 className="text-2xl font-semibold">Начните с курса или демо</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/75">
                  Если аккаунт уже есть, войдите. Если нужно быстро оценить интерфейс, откройте демо.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link to="/login">
                  <Button variant="secondary" className="w-full bg-background text-foreground hover:bg-background/90 sm:w-auto">
                    Войти
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button variant="outline" className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto">
                    Демо
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card px-4 py-8 sm:px-6">
        <div className="container mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Picrete. Проверка работ по химии.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/privacy" className="hover:text-foreground">
              Конфиденциальность
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Соглашение
            </Link>
            <Link to="/consent" className="hover:text-foreground">
              Персональные данные
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
