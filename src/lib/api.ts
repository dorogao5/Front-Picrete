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
export type WorkKind = "control" | "homework";
export type UploadSource = "web" | "telegram";

export interface SessionImage {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  order_index: number;
  upload_source: UploadSource;
  uploaded_at: string;
  view_url?: string | null;
}

export interface TaskBankSource {
  id: string;
  code: string;
  title: string;
  version: string;
}

export interface TaskBankItemImage {
  id: string;
  thumbnail_url: string;
  full_url: string;
}

export interface TaskBankItem {
  id: string;
  source: string;
  number: string;
  paragraph: string;
  topic: string;
  text: string;
  has_answer: boolean;
  answer?: string | null;
  images: TaskBankItemImage[];
}

export interface TrainerSetSummary {
  id: string;
  title: string;
  source: string;
  source_title: string;
  filters: JsonObject;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrainerSet {
  id: string;
  title: string;
  source: string;
  source_title: string;
  filters: JsonObject;
  created_at: string;
  updated_at: string;
  items: TaskBankItem[];
}

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
  kind: WorkKind;
  start_time: string;
  end_time: string;
  duration_minutes?: number | null;
  timezone: string;
  max_attempts: number;
  allow_breaks: boolean;
  break_duration_minutes: number;
  auto_save_interval?: number;
  ocr_enabled?: boolean;
  llm_precheck_enabled?: boolean;
  task_types: ExamTaskTypePayload[];
}

export interface ExamUpdatePayload {
  title?: string;
  description?: string;
  kind?: WorkKind;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number | null;
  timezone?: string;
  max_attempts?: number;
  allow_breaks?: boolean;
  break_duration_minutes?: number;
  auto_save_interval?: number;
  ocr_enabled?: boolean;
  llm_precheck_enabled?: boolean;
  task_types?: ExamTaskTypePayload[];
}

export interface OcrIssueInput {
  anchor: JsonObject;
  original_text?: string | null;
  suggested_text?: string | null;
  note: string;
  severity?: "minor" | "major" | "critical";
}

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://picrete.com/api/v1" : "http://localhost:8000/api/v1");

/** Origin of the API (e.g. https://example.com). Used to build full URLs and avoid double /api/v1 when backend returns paths. */
function getApiOrigin(): string {
  try {
    return new URL(API_URL).origin;
  } catch {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return "";
  }
}

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

/**
 * Fetches an image URL with auth (Bearer) and returns a blob URL for use in img src.
 * Backend returns paths like /api/v1/courses/...; we build full URL from origin to avoid baseURL doubling the prefix.
 * Caller must revoke the returned URL with URL.revokeObjectURL when done (e.g. on unmount or when no longer needed).
 */
export async function fetchImageAsBlobUrl(url: string): Promise<string> {
  const origin = getApiOrigin();
  const requestUrl =
    url.startsWith("http://") || url.startsWith("https://") || !origin
      ? url
      : new URL(url, origin).toString();
  const res = await api.get<Blob>(requestUrl, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

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

  delete: (courseId: string) => api.delete(`/courses/${courseId}`),

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

  addTaskTypesFromBank: (examId: string, data: { bank_item_ids: string[] }, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/exams/${examId}/task-types/from-bank`, data),

  listSubmissions: (
    examId: string,
    courseId?: string,
    params?: { status?: string; skip?: number; limit?: number }
  ) => api.get(`${coursePrefix(courseId)}/exams/${examId}/submissions`, { params }),
};

export const taskBankAPI = {
  sources: (courseId?: string) => api.get(`${coursePrefix(courseId)}/task-bank/sources`),

  listItems: (
    courseId?: string,
    params?: {
      source?: string;
      paragraph?: string;
      topic?: string;
      has_answer?: boolean;
      skip?: number;
      limit?: number;
    }
  ) => api.get(`${coursePrefix(courseId)}/task-bank/items`, { params }),
};

export const trainerAPI = {
  generateSet: (
    data: {
      source: string;
      filters?: { paragraph?: string; topic?: string; has_answer?: boolean };
      count: number;
      title?: string;
      seed?: number;
    },
    courseId?: string
  ) => api.post(`${coursePrefix(courseId)}/trainer/sets/generate`, data),

  createManualSet: (
    data: { source: string; numbers: string[]; title?: string },
    courseId?: string
  ) => api.post(`${coursePrefix(courseId)}/trainer/sets/manual`, data),

  listSets: (courseId?: string, params?: { skip?: number; limit?: number }) =>
    api.get(`${coursePrefix(courseId)}/trainer/sets`, { params }),

  getSet: (setId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/trainer/sets/${setId}`),

  deleteSet: (setId: string, courseId?: string) =>
    api.delete(`${coursePrefix(courseId)}/trainer/sets/${setId}`),
};

export const materialsAPI = {
  additionPdfUrl: (courseId?: string) => api.get(`${coursePrefix(courseId)}/materials/addition-pdf-url`),

  openAdditionPdf: async (courseId?: string) => {
    const resolvedCourseId = resolveCourseId(courseId);
    const popup = window.open("about:blank", "_blank");

    try {
      const response = await api.get(`/courses/${resolvedCourseId}/materials/addition-pdf/view`, {
        responseType: "blob",
      });
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      if (popup) {
        popup.location.href = blobUrl;
      } else {
        // Popup can be blocked by browser/CSP; fallback to current tab.
        window.location.href = blobUrl;
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 300_000);
    } catch (error) {
      if (popup) {
        popup.close();
      }
      throw error;
    }
  },
};

export const submissionsAPI = {
  mySubmissions: (courseId?: string) => api.get(`${coursePrefix(courseId)}/submissions/my-submissions`),

  enterExam: (examId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/exams/${examId}/enter`),

  getSessionVariant: (sessionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/variant`),

  uploadImage: (sessionId: string, file: File, orderIndex?: number, courseId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (typeof orderIndex === "number") {
      formData.append("order_index", orderIndex.toString());
    }
    return api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  listSessionImages: (sessionId: string, courseId?: string) =>
    api.get<{ items: SessionImage[] }>(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/images`),

  deleteSessionImage: (sessionId: string, imageId: string, courseId?: string) =>
    api.delete(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/images/${imageId}`),

  submit: (sessionId: string, courseId?: string) =>
    api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/submit`),

  getOcrPages: (sessionId: string, courseId?: string) =>
    api.get(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/ocr-pages`),

  reviewOcrPage: (
    sessionId: string,
    imageId: string,
    data: { page_status: "approved" | "reported"; issues: OcrIssueInput[] },
    courseId?: string
  ) =>
    api.post(
      `${coursePrefix(courseId)}/submissions/sessions/${sessionId}/ocr-pages/${imageId}/review`,
      data
    ),

  finalizeOcrReview: (
    sessionId: string,
    data: { action: "submit" | "report"; report_summary?: string },
    courseId?: string
  ) => api.post(`${coursePrefix(courseId)}/submissions/sessions/${sessionId}/ocr/finalize`, data),

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
  }) => api.get("/users", { params }),

  create: (data: {
    username: string;
    full_name: string;
    password: string;
    is_platform_admin?: boolean;
    is_active?: boolean;
  }) => api.post("/users", data),

  get: (userId: string) => api.get(`/users/${userId}`),

  update: (
    userId: string,
    data: {
      full_name?: string;
      password?: string;
      is_platform_admin?: boolean;
      is_active?: boolean;
    }
  ) => api.patch(`/users/${userId}`, data),

  delete: (userId: string) => api.delete(`/users/${userId}`),
};
