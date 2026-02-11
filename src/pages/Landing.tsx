import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Beaker, Bot, CheckCircle2, ScanText, ShieldCheck } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(248_78%_96%)_0%,_hsl(0_0%_100%)_42%,_hsl(0_0%_100%)_100%)]">
      <Navbar />

      <section className="pt-28 pb-14 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="mx-auto w-fit rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            Picrete для химии
          </div>
          <h1 className="mt-6 text-center text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Проверка домашних и контрольных
            <br />
            в одном рабочем контуре
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
            Продвинутый OCR, AI оценка с помощью специализированных LLM и предметная логика по химии:
            Picrete собирает решение по шагам, проверяет по критериям и оставляет преподавателю контроль над итогом.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/signup">
              <Button size="lg" className="px-8">
                Начать работу
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-center">
              Домашние работы и контрольные
            </div>
            <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-center">
              Прозрачная проверка по критериям
            </div>
            <div className="rounded-xl border border-border/70 bg-white/70 p-3 text-center">
              Проверка преподавателем в один клик
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Что делает Picrete</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Card className="border-border/60 bg-white/80 p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ScanText className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Продвинутый OCR</h3>
              <p className="mt-2 text-muted-foreground">
                Распознаёт рукописные решения, формулы и табличные данные, собирает текст в единый контекст проверки.
              </p>
            </Card>

            <Card className="border-border/60 bg-white/80 p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">AI оценка с помощью специализированных LLM</h3>
              <p className="mt-2 text-muted-foreground">
                Оценка идёт по рубрикам и проверочным правилам курса, с объяснимыми комментариями к каждому критерию.
              </p>
            </Card>

            <Card className="border-border/60 bg-white/80 p-6">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Решение остаётся у преподавателя</h3>
              <p className="mt-2 text-muted-foreground">
                AI предлагает балл и комментарий, преподаватель подтверждает или корректирует результат перед публикацией.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-8 px-6">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-border/60 bg-gradient-to-r from-white to-secondary/30 p-6 sm:p-8">
            <h2 className="text-2xl font-bold sm:text-3xl">Почему это не просто GPT-обёртка</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Beaker className="h-4 w-4" />
                </div>
                <p className="font-medium">Предметная проверка химии</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Учитываются уравнивание, размерности, стехиометрия и критерии конкретной работы.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <p className="font-medium">Контролируемый workflow</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  OCR, AI-препроверка, ревью преподавателя и финальная оценка собраны в едином процессе.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/80 p-4">
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <p className="font-medium">Прозрачные комментарии</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Для каждого балла есть пояснение, что упрощает апелляции и обратную связь студенту.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="py-14 px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-0 bg-gradient-to-br from-primary via-accent to-primary p-8 text-center shadow-glow sm:p-10">
            <h2 className="text-3xl font-bold text-white">Посмотрите продукт в действии</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/90">
              Откройте краткое демо интерфейса студента и преподавателя.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/demo">
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  Открыть демо
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground space-y-3">
          <p>© 2026 Picrete. Платформа проверки работ по химии</p>
          <div className="flex justify-center gap-4 text-sm">
            <Link to="/privacy" className="hover:underline text-muted-foreground hover:text-foreground">
              Политика конфиденциальности
            </Link>
            <span aria-hidden>•</span>
            <Link to="/terms" className="hover:underline text-muted-foreground hover:text-foreground">
              Пользовательское соглашение
            </Link>
            <span aria-hidden>•</span>
            <Link to="/consent" className="hover:underline text-muted-foreground hover:text-foreground">
              Согласие на обработку персональных данных
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
