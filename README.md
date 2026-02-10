# Front-Picrete

Frontend для платформы Picrete (React + TypeScript + Vite).

## Что реализовано

- Course-scoped routing (`/c/:courseId/...`) с membership-based доступом.
- Auth flow: signup/login + join-course по invite.
- Teacher workflow: создание/редактирование работ, проверка submissions.
- Student workflow: прохождение работ, OCR review, просмотр результатов.
- Типы работ: `control` и `homework`.
- Task bank + trainer sets.
- Кнопка “Дополнительные материалы” (PDF в новой вкладке через авторизованный blob-open).

## Технологии

- React 18 + TypeScript
- Vite
- React Router
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

Минимум:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Если `VITE_API_URL` не задан:
- dev: `http://localhost:8000/api/v1`
- prod: `https://picrete.com/api/v1`

## Команды

```bash
npm run dev
npm run build
npm run lint
```

## Главные директории

```text
src/
  pages/
  components/
  lib/
```

- `src/lib/auth.ts` — client auth/session + membership helpers.
- `src/lib/api.ts` — API contracts и axios wrappers.
- `src/App.tsx` — маршрутизация и protected routes.

## Основные страницы

- Auth: `Login`, `Signup`, `JoinCourse`
- Teacher: `TeacherDashboard`, `CreateExam`, `ExamSubmissions`, `SubmissionReview`
- Student: `StudentDashboard`, `TakeExam`, `OcrReview`, `ExamResult`
- Task Bank/Trainer: `TaskBank`, `TrainerSets`, `TrainerSetView`
- Admin: `AdminDashboard`

## Связь с backend

Ожидается backend Picrete c API `/api/v1` и course-scoped endpoints:
- `/courses/:course_id/exams`
- `/courses/:course_id/submissions`
- `/courses/:course_id/task-bank`
- `/courses/:course_id/trainer`
- `/courses/:course_id/materials`

Подробнее по архитектуре: `ARCHITECTURE.md`.
