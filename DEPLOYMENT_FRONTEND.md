# Команды для деплоя Frontend платформы Picrete

## Предварительные условия
- Сервер: 51.250.39.141
- Домен: picrete.com (уже настроен в DNS)
- Node.js 18+ установлен
- Директория создана: /srv/picrete/landing (для статических файлов)
- Backend уже развернут и доступен по адресу https://picrete.com/api/v1

## Порядок выполнения команд
Выполняйте команды по порядку, проверяя каждый шаг перед переходом к следующему.

---

## 1. Установка Node.js и npm (если не установлены)

```bash
# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка установки
node --version
npm --version
```

---

## 2. Клонирование репозитория Frontend

```bash
# Создать рабочую директорию (можно использовать временную)
mkdir -p ~/frontend-build
cd ~/frontend-build

# Клонировать репозиторий Frontend
git clone https://github.com/dorogao5/Front-Picrete.git .
```

---

## 3. Настройка переменных окружения

```bash
# Перейти в директорию проекта
cd ~/frontend-build

# Проверить файл env.production
cat env.production
# Должно быть: VITE_API_URL=https://picrete.com/api/v1

# Если нужно изменить API URL, отредактируйте env.production
# nano env.production
```

---

## 4. Сборка Frontend

```bash
# Перейти в директорию проекта
cd ~/frontend-build

# Установить зависимости (может занять несколько минут)
npm install

# Проверить что зависимости установлены
test -d node_modules && echo "Зависимости установлены" || echo "ОШИБКА: зависимости не установлены"

# Собрать фронтенд для production
npm run build

# Проверить что сборка прошла успешно
test -d dist && echo "Сборка успешна" || echo "ОШИБКА: сборка не удалась"

# Проверить содержимое dist
ls -la dist/
```

---

## 5. Развертывание Frontend

```bash
# Убедиться что директория landing существует
sudo mkdir -p /srv/picrete/landing

# Очистить старые файлы (опционально, для чистого деплоя)
# sudo rm -rf /srv/picrete/landing/*

# Скопировать собранные файлы в директорию для nginx
sudo cp -r ~/frontend-build/dist/* /srv/picrete/landing/

# Установить правильные права доступа
sudo chown -R www-data:www-data /srv/picrete/landing
sudo chmod -R 755 /srv/picrete/landing

# Проверить что файлы скопированы
ls -la /srv/picrete/landing/
test -f /srv/picrete/landing/index.html && echo "index.html найден" || echo "ОШИБКА: index.html не найден"
```

---

## 6. Проверка развертывания

```bash
# Проверить что фронтенд доступен через HTTPS
curl -I https://picrete.com
# Должен вернуть HTTP 200 и правильные заголовки

echo ""
echo "Проверка статических файлов:"
curl -I https://picrete.com/assets/index.js 2>&1 | head -3
# Должен вернуть HTTP 200 (если файл существует)

# Проверить в браузере
# Откройте https://picrete.com в браузере и убедитесь что страница загружается
```

---

## 7. Обновление Frontend

Для обновления frontend после изменений:

```bash
# Перейти в рабочую директорию
cd ~/frontend-build

# Обновить код из репозитория
git pull origin main

# Установить новые зависимости (если изменились)
npm install

# Пересобрать фронтенд
npm run build

# Скопировать новые файлы
sudo cp -r dist/* /srv/picrete/landing/
sudo chown -R www-data:www-data /srv/picrete/landing
sudo chmod -R 755 /srv/picrete/landing

# Очистить кэш браузера (вручную) или добавить версионирование
```

---

## Автоматизация деплоя

Для автоматизации процесса деплоя можно создать скрипт:

```bash
# Создать скрипт деплоя
cat > ~/deploy-frontend.sh << 'EOF'
#!/bin/bash
set -e

BUILD_DIR=~/frontend-build
cd $BUILD_DIR

echo "Обновление кода..."
git pull origin main

echo "Установка зависимостей..."
npm install

echo "Сборка фронтенда..."
npm run build

echo "Развертывание..."
sudo cp -r dist/* /srv/picrete/landing/
sudo chown -R www-data:www-data /srv/picrete/landing
sudo chmod -R 755 /srv/picrete/landing

echo "✓ Деплой завершен!"
EOF

# Сделать скрипт исполняемым
chmod +x ~/deploy-frontend.sh

# Использовать:
# ~/deploy-frontend.sh
```

---

## Устранение неполадок

### Проблемы со сборкой

```bash
# Очистить кэш и node_modules
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### Проблемы с доступом к файлам

```bash
# Проверить права доступа
ls -la /srv/picrete/landing/

# Исправить права доступа
sudo chown -R www-data:www-data /srv/picrete/landing
sudo chmod -R 755 /srv/picrete/landing
```

### Проблемы с подключением к API

```bash
# Проверить переменную окружения
cat env.production
# Должно быть: VITE_API_URL=https://picrete.com/api/v1

# Проверить что API доступен
curl https://picrete.com/api/v1/healthz
# Должен вернуть JSON с статусом

# Если API недоступен, проверьте backend
```

### Проблемы с Nginx

```bash
# Проверить логи nginx
sudo tail -f /var/log/nginx/picrete_error.log

# Проверить что nginx обслуживает статику
sudo nginx -t

# Перезагрузить nginx
sudo systemctl reload nginx
```

---

## Разработка

Для локальной разработки:

```bash
# Клонировать репозиторий
git clone https://github.com/dorogao5/Front-Picrete.git
cd Front-Picrete

# Установить зависимости
npm install

# Создать файл .env для разработки
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env

# Запустить dev-сервер
npm run dev

# Приложение будет доступно по адресу http://localhost:5173
```

---

**Примечание:** Backend должен быть развернут и доступен перед развертыванием Frontend. См. инструкции по деплою Backend в репозитории Picrete: https://github.com/dorogao5/Picrete

