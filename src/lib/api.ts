import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://picrete.com/api/v1' : 'http://localhost:8000/api/v1');
// Create axios instance with default config
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    // Убеждаемся, что headers объект существует
    if (!config.headers) {
      config.headers = {} as any;
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
let isRedirecting = false;
let redirectTimeout: NodeJS.Timeout | null = null;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      
      // Не обрабатываем 401 на страницах авторизации
      const isAuthPage = currentPath.includes('/login') || 
                        currentPath.includes('/signup') || 
                        currentPath === '/';
      
      if (isAuthPage) {
        return Promise.reject(error);
      }
      
      // Проверяем, был ли токен отправлен в запросе
      const tokenInRequest = error.config?.headers?.Authorization;
      const hadTokenInRequest = !!tokenInRequest;
      const tokenInStorage = localStorage.getItem('access_token');
      
      // Удаляем токен ТОЛЬКО если он был отправлен в запросе и был в localStorage
      // Это означает, что токен был отправлен, но сервер его не принял (невалидный/устаревший)
      if (hadTokenInRequest && tokenInStorage) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        
        // Редиректим на логин ТОЛЬКО если токен был отправлен (значит должен быть валидным)
        if (!isRedirecting) {
          isRedirecting = true;
          
          // Очищаем предыдущий таймаут если был
          if (redirectTimeout) {
            clearTimeout(redirectTimeout);
          }
          
          // Задержка перед редиректом для завершения других запросов
          redirectTimeout = setTimeout(() => {
            isRedirecting = false;
            redirectTimeout = null;
            window.location.href = '/login';
          }, 200);
        }
      }
      // Если токен НЕ был отправлен - просто реджектим ошибку
      // Это означает, что запрос был без авторизации (например, после логина когда токен еще не применен)
      // В этом случае НЕ удаляем токен и НЕ редиректим
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (data: { isu: string; full_name: string; password: string; role: string; pd_consent: boolean; pd_consent_version?: string; terms_version?: string; privacy_version?: string }) =>
    api.post('/auth/signup', data),
  
  login: (data: { isu: string; password: string }) =>
    api.post('/auth/login', data),
  
  me: () => api.get('/auth/me'),
};

// Exams API
export const examsAPI = {
  list: (params?: { status?: string; skip?: number; limit?: number }) =>
    api.get('/exams/', { params }),
  
  get: (examId: string) =>
    api.get(`/exams/${examId}`),
  
  create: (data: any) =>
    api.post('/exams/', data),
  
  update: (examId: string, data: any) =>
    api.patch(`/exams/${examId}`, data),
  
  delete: (examId: string, forceDelete: boolean = false) =>
    api.delete(`/exams/${examId}`, { params: { force_delete: forceDelete } }),
  
  publish: (examId: string) =>
    api.post(`/exams/${examId}/publish`),
  
  addTaskType: (examId: string, data: any) =>
    api.post(`/exams/${examId}/task-types`, data),
  
  listSubmissions: (examId: string, params?: { status?: string; skip?: number; limit?: number }) =>
    api.get(`/exams/${examId}/submissions`, { params }),
};

// Submissions API
export const submissionsAPI = {
  mySubmissions: () =>
    api.get('/submissions/my-submissions'),
  
  enterExam: (examId: string) =>
    api.post(`/submissions/exams/${examId}/enter`),
  
  getSessionVariant: (sessionId: string) =>
    api.get(`/submissions/sessions/${sessionId}/variant`),
  
  uploadImage: (sessionId: string, file: File, orderIndex: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('order_index', orderIndex.toString());
    return api.post(`/submissions/sessions/${sessionId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  submit: (sessionId: string) =>
    api.post(`/submissions/sessions/${sessionId}/submit`),
  
  getResult: (sessionId: string) =>
    api.get(`/submissions/sessions/${sessionId}/result`),
  
  get: (submissionId: string) =>
    api.get(`/submissions/${submissionId}`),
  
  getImageViewUrl: (imageId: string) =>
    api.get(`/submissions/images/${imageId}/view-url`),
  
  approve: (submissionId: string, data?: { teacher_comments?: string }) =>
    api.post(`/submissions/${submissionId}/approve`, data),
  
  overrideScore: (submissionId: string, data: { final_score: number; teacher_comments: string }) =>
    api.post(`/submissions/${submissionId}/override-score`, data),
};

// Users API
export const usersAPI = {
  me: () => api.get('/users/me'),
  
  list: (params?: { skip?: number; limit?: number; isu?: string; role?: string; is_active?: boolean; is_verified?: boolean }) =>
    api.get('/users/', { params }),
  
  create: (data: any) =>
    api.post('/users/', data),

  get: (userId: string) =>
    api.get(`/users/${userId}`),
  
  update: (userId: string, data: any) =>
    api.patch(`/users/${userId}`, data),
};

