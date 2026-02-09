import axios from "axios";

import { clearAuthSession, getActiveCourseId, getAuthToken } from "./auth";

export interface ApiErrorBody {
  detail?: string;
  message?: string;
}

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.detail ?? error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export const getApiErrorStatus = (error: unknown): number | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  return error.response?.status;
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

interface ExamVariantPayload {
  content: string;
  parameters: JsonObject;
  reference_solution: string;
  reference_answer: string;
  answer_tolerance: number;
}

export interface ExamTaskTypePayload {
  title: string;
  description: string;
  order_index: number;
  max_score: number;
  rubric: JsonObject;
  difficulty: "easy" | "medium" | "hard";
  taxonomy_tags: string[];
  formulas: string[];
  units: string[];
  validation_rules: JsonObject;
  variants: ExamVariantPayload[];
}

export interface ExamCreatePayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  timezone: string;
  max_attempts: number;
  allow_breaks: boolean;
  break_duration_minutes: number;
  auto_save_interval?: number;
  task_types: ExamTaskTypePayload[];
}

export interface ExamUpdatePayload {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  timezone?: string;
  max_attempts?: number;
  allow_breaks?: boolean;
  break_duration_minutes?: number;
  auto_save_interval?: number;
  task_types?: ExamTaskTypePayload[];
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://picrete.com/api/v1" : "http://localhost:8000/api/v1");

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const pathname = window.location.pathname;
      const isPublic =
        pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/signup");

      if (!isPublic && !isRedirecting) {
        isRedirecting = true;
        clearAuthSession();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

const resolveCourseId = (courseId?: string): string => {
  const resolved = courseId ?? getActiveCourseId();
  if (!resolved) {
    throw new Error("Active course is not selected");
  }
  return resolved;
};

const coursePrefix = (courseId?: string) => `/courses/${resolveCourseId(courseId)}`;

export const authAPI = {
  signup: (data: {
    username: string;
    full_name: string;
    password: string;
    invite_code?: string;
    identity_payload?: Record<string, unknown>;
    pd_consent: boolean;
    pd_consent_version?: string;
    terms_version?: string;
    privacy_version?: string;
  }) => api.post("/auth/signup", data),

  login: (data: { username: string; password: string }) => api.post("/auth/login", data),

  me: () => api.get("/auth/me"),
};

export const coursesAPI = {
  list: () => api.get("/courses"),

  create: (data: { slug: string; title: string; organization?: string }) => api.post("/courses", data),

  update: (
    courseId: string,
    data: { title?: string; organization?: string; is_active?: boolean }
  ) => api.patch(`/courses/${courseId}`, data),

  rotateInviteCode: (courseId: string, data: { role: "teacher" | "student" }) =>
    api.post(`/courses/${courseId}/invite-codes/rotate`, data),

  updateIdentityPolicy: (
    courseId: string,
    data: {
      rule_type: "none" | "isu_6_digits" | "email_domain" | "custom_text_validator";
      rule_config?: Record<string, unknown>;
    }
  ) => api.patch(`/courses/${courseId}/identity-policy`, data),

  join: (data: { invite_code: string; identity_payload?: Record<string, unknown> }) =>
    api.post("/courses/join", data),
};

export const examsAPI = {
  list: (courseId?: string, params?: { status?: string; skip?: number; limit?: number }) =>
    api.get(`${coursePrefix(courseId)}/exams`, { params }),

  get: (examId: string, courseId?: string) => api.get(`${coursePrefix(courseId)}/exams/${examId}`),

  create: (data: ExamCreatePayload, courseId?: string) => api.post(`${coursePrefix(courseId)}/exams`, data),

  update: (examId: string, data: ExamUpdatePayload, courseId?: string) =>
    api.patch(`${coursePrefix(courseId)}/exams/${examId}`, data),

  delete: (examId: string, forceDelete = false, courseId?: string) =>
    api.delete(`${coursePrefix(courseId)}/exams/${examId}`, { params: { force_delete: forceDelete } }),

  publish: (examId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/exams/${examId}/publish`),

  addTaskType: (examId: string, data: ExamTaskTypePayload, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/exams/${examId}/task-types`, data),

  listSubmissions: (
    examId: string,
    courseId?: string,
    params?: { status?: string; skip?: number; limit?: number }
  ) => api.get(`${coursePrefix(courseId)}/exams/${examId}/submissions`, { params }),
};

export const submissionsAPI = {
  mySubmissions: (courseId?: string) => api.get(`${coursePrefix(courseId)}/submissions/my-submissions`),

  enterExam: (examId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/exams/${examId}/enter`),

  getSessionVariant: (sessionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/variant`),

  uploadImage: (sessionId: string, file: File, orderIndex: number, courseId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("order_index", orderIndex.toString());
    return api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  submit: (sessionId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/submit`),

  getResult: (sessionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/result`),

  get: (submissionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/${submissionId}`),

  getImageViewUrl: (imageId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/images/${imageId}/view-url`),

  approve: (submissionId: string, data?: { teacher_comments?: string }, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/${submissionId}/approve`, data),

  overrideScore: (
    submissionId: string,
    data: { final_score: number; teacher_comments: string },
    courseId?: string
  ) => api.post(`${coursePrefix(courseId)}/submissions/${submissionId}/override-score`, data),

  regrade: (submissionId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/${submissionId}/regrade`),

  gradingStatus: (submissionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/grading-status/${submissionId}`),

  autoSave: (sessionId: string, data: Record<string, unknown>, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/auto-save`, data),
};

export const usersAPI = {
  me: () => api.get("/users/me"),

  list: (params?: {
    skip?: number;
    limit?: number;
    username?: string;
    isPlatformAdmin?: boolean;
    isActive?: boolean;
    isVerified?: boolean;
  }) => api.get("/users", { params }),

  create: (data: {
    username: string;
    full_name: string;
    password: string;
    is_platform_admin?: boolean;
    is_active?: boolean;
    is_verified?: boolean;
  }) => api.post("/users", data),

  get: (userId: string) => api.get(`/users/${userId}`),

  update: (
    userId: string,
    data: {
      full_name?: string;
      password?: string;
      is_platform_admin?: boolean;
      is_active?: boolean;
      is_verified?: boolean;
    }
  ) => api.patch(`/users/${userId}`, data),
};
