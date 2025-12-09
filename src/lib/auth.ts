import { authAPI } from './api';

export interface User {
  id: string;
  isu: string;
  full_name: string;
  role: 'admin' | 'teacher' | 'assistant' | 'student';
  is_active: boolean;
  is_verified: boolean;
  pd_consent?: boolean;
  pd_consent_at?: string | null;
  pd_consent_version?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
}

export const setAuthToken = (token: string) => {
  localStorage.setItem('access_token', token);
};

export const setUser = (user: User) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token');
};

export const getUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  window.location.href = '/';
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export const isTeacher = (): boolean => {
  const user = getUser();
  return user?.role === 'teacher' || user?.role === 'admin';
};

export const isAdmin = (): boolean => {
  const user = getUser();
  return user?.role === 'admin';
};

export const isStudent = (): boolean => {
  const user = getUser();
  return user?.role === 'student';
};

