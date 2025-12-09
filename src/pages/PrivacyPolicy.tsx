import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="container mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Политика конфиденциальности</h1>
          <p className="text-muted-foreground">Версия от 09.12.2025</p>
          <p className="text-muted-foreground text-sm">
            Настоящая политика подготовлена с учётом требований 152-ФЗ «О персональных данных», 242-ФЗ (локализация данных) и 149-ФЗ.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">1. Оператор</h2>
            <p className="text-muted-foreground">
              Оператором персональных данных является сервис Picrete (онлайн-платформа для проверки контрольных работ по химии).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">2. Какие данные обрабатываем</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>ФИО</li>
              <li>Номер ИСУ (6 цифр)</li>
              <li>Учётные данные (пароль хранится в виде хэша)</li>
              <li>Роль пользователя (студент, преподаватель, администратор)</li>
              <li>Загруженные изображения работ и ответы</li>
              <li>Системные логи для безопасности и аудита</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">3. Цели обработки</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Предоставление доступа к сервису и учёт ролей</li>
              <li>Проверка и хранение работ студентов</li>
              <li>Генерация аналитики и отчётов</li>
              <li>Обеспечение информационной безопасности</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">4. Правовые основания</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Согласие субъекта персональных данных</li>
              <li>Исполнение договора (оферта) с пользователем</li>
              <li>Законные интересы оператора (защита информации, предотвращение злоупотреблений)</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">5. Локализация и хранение</h2>
            <p className="text-muted-foreground">
              Персональные данные российских пользователей хранятся и обрабатываются на серверах, расположенных на территории РФ, в соответствии с 242-ФЗ.
              Срок хранения — до достижения целей обработки или отзыва согласия, если иное не требуется по закону.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">6. Передача третьим лицам</h2>
            <p className="text-muted-foreground">
              Доступ к данным может предоставляться подрядчикам (хостинг, облачное хранилище, средства защиты),
              действующим по поручению оператора и на основании договоров с требованиями 152-ФЗ.
              Трансграничная передача не допускается, кроме стран с адекватной защитой или при отдельном согласии.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">7. Права пользователей</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Получать сведения об обработке данных</li>
              <li>Требовать уточнения, блокирования или уничтожения данных</li>
              <li>Отозвать согласие на обработку персональных данных</li>
              <li>Обжаловать действия оператора в Роскомнадзор или суд</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">8. Безопасность</h2>
            <p className="text-muted-foreground">
              Применяются организационные и технические меры: контроль доступа, журналирование, резервное копирование,
              шифрование каналов (TLS), хранение паролей в виде хэшей. Доступ к системам ограничен авторизацией.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-semibold">9. Обращения</h2>
            <p className="text-muted-foreground">
              Запросы по вопросам персональных данных и отзыв согласия можно направить через контакт, указанный в интерфейсе сервиса.
            </p>
          </section>

          <div className="pt-4 text-sm text-muted-foreground">
            <Link to="/consent" className="text-primary hover:underline">
              Согласие на обработку персональных данных
            </Link>{" "}
            |{" "}
            <Link to="/terms" className="text-primary hover:underline">
              Пользовательское соглашение
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

