# Front-Picrete

**Frontend приложение для платформы Picrete**

Front-Picrete — это React + TypeScript frontend приложение для платформы автоматизированной проверки контрольных работ по химии с использованием искусственного интеллекта.

## Технологический стек

- **React 18** + **TypeScript** — пользовательский интерфейс
- **Vite** — сборщик и dev-сервер
- **React Router** — маршрутизация
- **shadcn/ui** — компоненты UI
- **Tailwind CSS** — стилизация
- **TanStack Query** — управление состоянием и кэширование запросов
- **KaTeX** — отображение математических формул (LaTeX)

## Структура проекта

```
Front-Picrete/
├── src/
│   ├── components/      # React компоненты
│   ├── pages/           # Страницы приложения
│   ├── lib/             # Утилиты и API клиент
│   └── hooks/           # React хуки
├── public/              # Статические файлы
├── package.json
└── vite.config.ts
```

## Быстрый старт

### Предварительные требования

- Node.js 18+
- npm или yarn

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/dorogao5/Front-Picrete.git
cd Front-Picrete

# Установить зависимости
npm install
```

### Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Для production используйте файл `env.production`:

```env
VITE_API_URL=https://picrete.com/api/v1
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173`

### Сборка для production

```bash
npm run build
```

Собранные файлы будут в директории `dist/`

### Предпросмотр production сборки

```bash
npm run preview
```

## Разработка

### Основные команды

- `npm run dev` — запуск dev-сервера
- `npm run build` — сборка для production
- `npm run preview` — предпросмотр production сборки
- `npm run lint` — проверка кода линтером

### Структура компонентов

- `src/components/ui/` — базовые UI компоненты (shadcn/ui)
- `src/components/` — специфичные компоненты приложения
- `src/pages/` — страницы приложения
- `src/lib/` — утилиты и API клиент

### API клиент

API клиент находится в `src/lib/api.ts` и автоматически использует переменную окружения `VITE_API_URL` для подключения к backend.

## Деплой

Для production деплоя:

1. Убедитесь, что `env.production` содержит правильный API URL
2. Соберите приложение: `npm run build`
3. Скопируйте содержимое `dist/` в директорию `/srv/picrete/landing/` на сервере

Подробные инструкции по деплою см. в `DEPLOYMENT_FRONTEND.md`

## Связь с Backend

Frontend подключается к backend API через переменную окружения `VITE_API_URL`:
- Development: `http://localhost:8000/api/v1`
- Production: `https://picrete.com/api/v1`

Backend репозиторий: https://github.com/dorogao5/Picrete

## Лицензия

Copyright (c) 2024

