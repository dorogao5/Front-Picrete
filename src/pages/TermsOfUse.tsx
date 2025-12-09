import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

const TermsOfUse = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Пользовательское соглашение (оферта)</h1>
          <p className="text-muted-foreground">Версия от 09.12.2025</p>
        </div>

        <Card className="p-6 space-y-4">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Предмет</h2>
            <p className="text-muted-foreground">
              Сервис Picrete предоставляет доступ к онлайн-платформе автоматизированной проверки контрольных работ по химии.
              Пользователь принимает условия настоящей оферты с момента регистрации в сервисе.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. Регистрация и учётные данные</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Пользователь указывает достоверные данные (ФИО, номер ИСУ).</li>
              <li>Пароль хранится в зашифрованном (хэшированном) виде, пользователь отвечает за его конфиденциальность.</li>
              <li>Администратор может блокировать аккаунт при нарушении условий.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">3. Роли и права</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Студент: загрузка работ, получение результатов.</li>
              <li>Преподаватель: создание заданий, просмотр и утверждение оценок.</li>
              <li>Администратор: управление пользователями и настройками.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">4. Ограничения</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Запрещено размещение противоправного контента.</li>
              <li>Запрещено попытки несанкционированного доступа и тестирования безопасности без согласия оператора.</li>
              <li>Запрещено передавать учётные данные третьим лицам.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">5. Ответственность</h2>
            <p className="text-muted-foreground">
              Сервис предоставляется «как есть». Оператор не несёт ответственность за сбои, вызванные действиями третьих лиц, провайдеров связи или форс-мажором,
              но предпринимает разумные меры для восстановления работоспособности.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Интеллектуальные права</h2>
            <p className="text-muted-foreground">
              Все права на программное обеспечение и контент сервиса принадлежат оператору.
              Пользователь получает ограниченную лицензию на использование функционала сервиса в рамках ролей.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">7. Персональные данные</h2>
            <p className="text-muted-foreground">
              Обработка персональных данных осуществляется согласно <Link to="/privacy" className="text-primary hover:underline">Политике конфиденциальности</Link>
              {" "}и <Link to="/consent" className="text-primary hover:underline">Согласию на обработку персональных данных</Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">8. Изменения условий</h2>
            <p className="text-muted-foreground">
              Оператор может обновлять условия, публикуя новую редакцию на сайте.
              Продолжение использования сервиса означает согласие с новой редакцией.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">9. Контакты</h2>
            <p className="text-muted-foreground">
              Обратная связь и запросы: через контакт в интерфейсе сервиса или указанный в разделе помощи.
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfUse;

