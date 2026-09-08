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
- React Router 7
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
- prod: `/api/v1` на текущем origin (same-origin reverse proxy).

## Скрипты

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

`npm run build` выполняет сборку Vite без отдельной проверки типов.
Для изменений TypeScript дополнительно используйте установленный компилятор:
`./node_modules/.bin/tsc --noEmit`.

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

- Маршруты и API: [src/App.tsx](src/App.tsx), [src/lib/api.ts](src/lib/api.ts).
- Backend README: `../Picrete/README.md`
- Backend architecture: `../Picrete/ARCHITECTURE.md`


## Согласованный выпуск

Релиз собирается из чистых коммитов `main` Picrete, Studio-Picrete и Front-Picrete.
SHA всех трёх репозиториев записываются в общий `release-manifest.json` рядом с
каталогами выпуска на сервере. Собранные файлы не редактируются вручную.
API публикуют свой SHA через `/version`, frontend — через `/build-info.json`.
Изменения контракта Studio → Picrete проверяются вместе с обоими интерфейсами.

Перед публикацией проходят проверки `.github/workflows/verify.yml`.
Секреты, пользовательские данные, каталоги банка и артефакты проверки не коммитятся.


## Учебный текст и формулы

`RichText` используется также в просмотре работ через `renderLatex` и
`renderTaskText`. Учебный текст и пояснения внутри формул используют локально
поставляемый STIX Two Text; интерфейс сохраняет Golos Text. Математические
символы и их метрики остаются под управлением KaTeX.

Короткие выражения переносятся целиком. Длинные выражения прокручиваются внутри
блока с подсказкой и доступом с клавиатуры. `remarkReadableMath` выносит обычную
речь из верхнеуровневых `\text{}` и превращает последовательные нумерованные
реакции в списки, сохраняя исходные данные. Вложенные формулы и окружения не
разбиваются. Проверка преобразований: `npm run test:math` (Node 22.6+).
