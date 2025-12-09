import { Link } from "react-router-dom";
import { Play, CheckCircle2, Sparkles, BarChart3 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Demo = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/20 to-background">
      <Navbar />

      <section className="pt-28 pb-16 px-6">
        <div className="container mx-auto max-w-5xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Живое демо Picrete
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent leading-tight">
            Как выглядит проверка контрольных в Picrete
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Пройдем путь студента и преподавателя: загрузка решения, автоматическая проверка и итоговая аналитика по классу.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="px-8 text-lg">
                Зарегистрироваться
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="px-8 text-lg">
                Войти
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="pb-12 px-6">
        <div className="container mx-auto max-w-6xl grid lg:grid-cols-2 gap-6">
          <Card className="p-6 sm:p-8 bg-gradient-card shadow-elegant border-border/60 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
              <Play className="h-4 w-4" />
              Демонстрация
            </div>
            <h2 className="text-2xl font-semibold">Студент загружает решение</h2>
            <p className="text-muted-foreground">
              Просто сфотографировать задачу и отправить. Picrete распознает рукописный текст, фиксирует все этапы решения и подсвечивает ключевые формулы.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-background/50 border border-border/60 p-4 text-left space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">AI-анализ</p>
                <p className="text-base">Проверяем стехиометрию, уравнивание реакций и размерности.</p>
              </div>
              <div className="rounded-xl bg-background/50 border border-border/60 p-4 text-left space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Результат для студента</p>
                <p className="text-base">Мгновенные подсказки, выделение ошибок и рекомендации по исправлению.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 sm:p-8 shadow-elegant border-border/60 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 text-accent px-3 py-1 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Проверка преподавателя
            </div>
            <h2 className="text-2xl font-semibold">Преподаватель подтверждает оценку</h2>
            <p className="text-muted-foreground">
              AI предлагает оценку и комментарии. Вы можете принять её, скорректировать баллы и добавить персональные замечания.
            </p>
            <ul className="space-y-3 text-left">
              <li className="flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <span>Шаги решения и ошибки подсвечены прямо в интерфейсе.</span>
              </li>
              <li className="flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <span>Справочник критериев — под рукой, чтобы оценки были прозрачными.</span>
              </li>
              <li className="flex gap-3 items-start">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <span>Готовые комментарии и автоответы экономят время.</span>
              </li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="container mx-auto max-w-5xl">
          <Card className="p-6 sm:p-8 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border-border/60">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="md:w-2/3 space-y-3">
                <div className="inline-flex items-center gap-2 text-primary font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Аналитика по классу
                </div>
                <h3 className="text-2xl font-semibold">Картина успеваемости в один клик</h3>
                <p className="text-muted-foreground">
                  Picrete показывает типичные ошибки, темы риска и распределение баллов. Настройте задания и ретесты сразу после проверки.
                </p>
              </div>
              <div className="md:w-1/3 flex flex-col gap-3">
                <Link to="/signup">
                  <Button size="lg" className="w-full">Попробовать бесплатно</Button>
                </Link>
                <Link to="/teacher">
                  <Button size="lg" variant="outline" className="w-full">Перейти в кабинет</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Demo;

