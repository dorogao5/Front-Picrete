import { Link } from "react-router-dom";
import { ArrowRight, Camera, ClipboardCheck, ScanText } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const Demo = () => {
  return (
    <div className="min-h-screen bg-notebook">
      <Navbar />

      <section className="pt-28 pb-14 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Демонстрация Picrete
          </p>
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
        <div className="container mx-auto max-w-6xl grid gap-8 md:grid-cols-3">
          <section className="border-t border-border pt-5">
            <div className="mb-4 text-accent">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 1</p>
            <h2 className="mt-1 text-xl font-semibold">Загрузка решения</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Студент отправляет фото, система собирает страницы и готовит решение к проверке.
            </p>
          </section>

          <section className="border-t border-border pt-5">
            <div className="mb-4 text-accent">
              <ScanText className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 2</p>
            <h2 className="mt-1 text-xl font-semibold">OCR и AI-проверка</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Продвинутый OCR извлекает текст, затем AI оценивает решение по критериям и химическим правилам.
            </p>
          </section>

          <section className="border-t border-border pt-5">
            <div className="mb-4 text-accent">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Шаг 3</p>
            <h2 className="mt-1 text-xl font-semibold">Ревью преподавателя</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Преподаватель видит объяснения и подтверждает оценку, либо корректирует баллы и комментарии.
            </p>
          </section>
        </div>
      </section>

      <section className="pb-12 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="border-t border-border pt-8">
            <h3 className="text-2xl font-semibold">Что увидите в демо</h3>
            <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Экран студента.</span> Загрузка изображений и отправка работы.
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Панель преподавателя.</span> Критерии, баллы, комментарии.
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">OCR review.</span> Проблемные места и история исправлений.
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-medium text-foreground">Работы курса.</span> Домашние и контрольные в одном интерфейсе.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-lg bg-primary p-7 text-left text-primary-foreground shadow-elegant sm:p-9">
            <h3 className="max-w-3xl text-3xl font-semibold leading-tight">Готово к запуску в вашем курсе</h3>
            <p className="mt-3 max-w-2xl text-primary-foreground/75">
              Подключите курс и получите единый контур для проверки работ без ручной рутины.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="w-full bg-background text-foreground hover:bg-background/90 sm:w-auto">
                  Подключить курс
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login" className="inline-flex h-11 items-center justify-center rounded-md border border-primary-foreground/25 px-5 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10">
                Уже есть аккаунт
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Demo;
