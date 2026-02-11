import { Link } from "react-router-dom";
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, ScanText, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Demo = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_hsl(248_78%_96%)_0%,_hsl(0_0%_100%)_48%,_hsl(0_0%_100%)_100%)]">
      <Navbar />

      <section className="pt-28 pb-14 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Демонстрация Picrete
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
            Как проходит проверка
            <br />
            от фото до финальной оценки
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base text-muted-foreground sm:text-lg">
            В демо показан полный рабочий цикл: загрузка решения студентом, Продвинутый OCR,
            AI оценка с помощью специализированных LLM и подтверждение преподавателем.
          </p>
        </div>
      </section>

      <section className="pb-10 px-6">
        <div className="container mx-auto max-w-6xl grid gap-5 md:grid-cols-3">
          <Card className="border-border/60 bg-white/80 p-6">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 1</p>
            <h2 className="mt-1 text-xl font-semibold">Загрузка решения</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Студент отправляет фото, система собирает страницы и готовит решение к проверке.
            </p>
          </Card>

          <Card className="border-border/60 bg-white/80 p-6">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScanText className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 2</p>
            <h2 className="mt-1 text-xl font-semibold">OCR и AI-проверка</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Продвинутый OCR извлекает текст, затем AI оценивает решение по критериям и химическим правилам.
            </p>
          </Card>

          <Card className="border-border/60 bg-white/80 p-6">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 3</p>
            <h2 className="mt-1 text-xl font-semibold">Ревью преподавателя</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Преподаватель видит объяснения и подтверждает оценку, либо корректирует баллы и комментарии.
            </p>
          </Card>
        </div>
      </section>

      <section className="pb-12 px-6">
        <div className="container mx-auto max-w-5xl">
          <Card className="border-border/60 bg-gradient-to-r from-white to-secondary/40 p-6 sm:p-8">
            <h3 className="text-2xl font-semibold">Что увидите в демо</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm">Экран студента: загрузка изображений и отправка работы</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm">Панель преподавателя: критерии, баллы, комментарии</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm">Трекинг OCR-проблем и прозрачная апелляционная история</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/80 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                <span className="text-sm">Сценарии для домашних и контрольных работ в одном интерфейсе</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-0 bg-gradient-to-br from-primary via-accent to-primary p-8 text-center shadow-glow sm:p-10">
            <h3 className="text-3xl font-bold text-white">Готово к запуску в вашем курсе</h3>
            <p className="mx-auto mt-3 max-w-2xl text-white/90">
              Подключите курс и получите единый контур для проверки работ без ручной рутины.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                  Подключить курс
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-4 text-sm text-white/85">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="underline underline-offset-4">
                Войти
              </Link>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Demo;
