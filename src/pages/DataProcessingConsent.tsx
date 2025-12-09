import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

const DataProcessingConsent = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Согласие на обработку персональных данных</h1>
          <p className="text-muted-foreground">Версия от 09.12.2025</p>
        </div>

        <Card className="p-6 space-y-4">
          <p className="text-muted-foreground">
            Я, пользователь сервиса Picrete, свободно, своей волей и в своём интересе даю согласие оператору на обработку моих персональных данных
            в соответствии с Федеральным законом №152-ФЗ «О персональных данных».
          </p>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Перечень данных</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>ФИО</li>
              <li>Номер ИСУ</li>
              <li>Роль в системе</li>
              <li>Загруженные изображения работ и ответы</li>
              <li>Техническая информация (логи, метаданные запросов) для целей безопасности</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Цели обработки</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Регистрация и авторизация в сервисе</li>
              <li>Предоставление функционала проверки работ</li>
              <li>Хранение и учёт результатов</li>
              <li>Исполнение пользовательского соглашения</li>
              <li>Обеспечение безопасности сервиса</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Действия с данными</h2>
            <p className="text-muted-foreground">
              Сбор, запись, систематизация, накопление, хранение на территории РФ, уточнение (обновление), извлечение,
              использование, передача подрядчикам по договору обработки, блокирование, удаление, уничтожение.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Срок действия</h2>
            <p className="text-muted-foreground">
              Согласие действует до достижения целей обработки или его отзыва. Отзыв возможен по запросу через указанный контакт в интерфейсе сервиса.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Права субъекта</h2>
            <p className="text-muted-foreground">
              Пользователь вправе получать сведения об обработке, требовать уточнения или уничтожения данных,
              а также отзывать согласие. При отзыве обработка прекращается, если иное не требуется по закону.
            </p>
          </section>

          <div className="pt-4 text-sm text-muted-foreground">
            Подробнее см.{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Политику конфиденциальности
            </Link>{" "}
            и{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Пользовательское соглашение
            </Link>
            .
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DataProcessingConsent;

