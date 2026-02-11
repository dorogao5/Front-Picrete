# Front-Picrete

Frontend платформы Picrete (React + TypeScript + Vite).

## Текущее состояние

- Course-scoped routing: `/c/:courseId/...`.
- Защита маршрутов по membership-ролям (`student`, `teacher`) + `admin`.
- Полный teacher/student workflow:
  - создание/публикация работ,
  - прохождение работ,
  - OCR review,
  - просмотр результатов,
  - проверка сабмишнов преподавателем.
- Task Bank + Trainer Sets.
- Дополнительные материалы (PDF) через авторизованный blob-open.

### Что важно в новой реализации загрузки

- На странице выполнения работы (`TakeExam`) одна общая зона загрузки фото, без привязки к номерам задач.
- Immediate upload: выбранный файл сразу уходит на backend.
- Источник истины для загруженных изображений — `GET .../sessions/:session_id/images`.
- Есть удаление изображения до завершения/истечения сессии.
- Идет polling списка изображений каждые 5 секунд (включая подхват загрузок из Telegram-бота).
- Сабмит ожидает завершения текущих загрузок (до 30 секунд), чтобы минимизировать потерю фото при отправке.

## Технологии

- React 18 + TypeScript
- Vite
- React Router 6
- TanStack Query
- Axios
- shadcn/ui + Tailwind
- Sonner
- KaTeX

## Быстрый старт

```bash
npm install
npm run dev
```

## Переменные окружения

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Если `VITE_API_URL` не задан:

- dev: `http://localhost:8000/api/v1`
- prod: `https://picrete.com/api/v1`

## Скрипты

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Ключевые директории

```text
src/
  pages/
  components/
  lib/
```

- `src/App.tsx` — маршрутизация и protected routes.
- `src/lib/auth.ts` — сессия, memberships, active course.
- `src/lib/api.ts` — axios-инстанс, API wrappers, DTO/типы.
- `src/pages/TakeExam.tsx` — единая загрузка фото + submit/autosubmit логика.

## Важно по image URL

В `src/lib/api.ts` функция `fetchImageAsBlobUrl(...)` корректно собирает абсолютный URL от origin API для путей вида `/api/v1/...`, чтобы избежать двойного префикса (`/api/v1/api/v1/...`) и 404.

## Интеграция с backend

Ожидается backend Picrete с route-префиксом `/api/v1` и course-scoped endpoints:

- `/courses/:course_id/exams`
- `/courses/:course_id/submissions`
- `/courses/:course_id/task-bank`
- `/courses/:course_id/trainer`
- `/courses/:course_id/materials`

## Документация

- Front architecture: `ARCHITECTURE.md`
- Backend README: `../Picrete/README.md`
- Backend architecture: `../Picrete/ARCHITECTURE.md`
