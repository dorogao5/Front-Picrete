export type CourseRole = "teacher" | "student";
export type MembershipStatus = "active" | "suspended" | "left";

export interface Membership {
  membership_id: string;
  course_id: string;
  course_slug: string;
  course_title: string;
  status: MembershipStatus;
  joined_at: string;
  roles: CourseRole[];
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  is_platform_admin: boolean;
  is_active: boolean;
  pd_consent?: boolean;
  pd_consent_at?: string | null;
  pd_consent_version?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  privacy_version?: string | null;
}

const ACCESS_TOKEN_KEY = "access_token";
const USER_KEY = "user";
const MEMBERSHIPS_KEY = "memberships";
const ACTIVE_COURSE_ID_KEY = "active_course_id";

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const setAuthToken = (token: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const getAuthToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);

export const setUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): User | null => parseJson<User | null>(localStorage.getItem(USER_KEY), null);

export const setMemberships = (memberships: Membership[]) => {
  localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(memberships));
};

export const getMemberships = (): Membership[] =>
  parseJson<Membership[]>(localStorage.getItem(MEMBERSHIPS_KEY), []);

export const getMembershipForCourse = (courseId: string): Membership | null =>
  getMemberships().find((membership) => membership.course_id === courseId) ?? null;

export const setActiveCourseId = (courseId: string | null) => {
  if (!courseId) {
    localStorage.removeItem(ACTIVE_COURSE_ID_KEY);
    return;
  }

  const membership = getMembershipForCourse(courseId);
  if (!membership || membership.status !== "active") {
    return;
  }

  localStorage.setItem(ACTIVE_COURSE_ID_KEY, courseId);
};

export const getActiveCourseId = (): string | null => {
  const memberships = getMemberships().filter((membership) => membership.status === "active");
  if (memberships.length === 0) {
    return null;
  }

  const stored = localStorage.getItem(ACTIVE_COURSE_ID_KEY);
  if (stored && memberships.some((membership) => membership.course_id === stored)) {
    return stored;
  }

  const fallback = memberships[0].course_id;
  localStorage.setItem(ACTIVE_COURSE_ID_KEY, fallback);
  return fallback;
};

export const setAuthSession = (params: {
  access_token: string;
  user: User;
  memberships: Membership[];
  active_course_id?: string | null;
}) => {
  setAuthToken(params.access_token);
  setUser(params.user);
  setMemberships(params.memberships ?? []);

  const memberships = params.memberships ?? [];
  const active =
    params.active_course_id && memberships.some((membership) => membership.course_id === params.active_course_id)
      ? params.active_course_id
      : memberships.find((membership) => membership.status === "active")?.course_id ?? null;
  setActiveCourseId(active);
};

export const clearAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(MEMBERSHIPS_KEY);
  localStorage.removeItem(ACTIVE_COURSE_ID_KEY);
};

export const logout = () => {
  clearAuthSession();
  window.location.href = "/";
};

export const isAuthenticated = (): boolean => Boolean(getAuthToken());

export const isAdmin = (): boolean => Boolean(getUser()?.is_platform_admin);

export const hasCourseRole = (courseId: string, role: CourseRole): boolean => {
  if (isAdmin()) return true;
  const membership = getMembershipForCourse(courseId);
  if (!membership || membership.status !== "active") return false;
  return membership.roles.includes(role);
};

export const getPreferredRoleForCourse = (courseId: string): CourseRole | null => {
  if (hasCourseRole(courseId, "teacher")) {
    return "teacher";
  }
  if (hasCourseRole(courseId, "student")) {
    return "student";
  }
  return null;
};

export const buildCoursePath = (courseId: string, segment: string) => {
  const suffix = segment.startsWith("/") ? segment : `/${segment}`;
  return `/c/${courseId}${suffix}`;
};

export const getCourseHomePath = (courseId: string): string => {
  const preferredRole = getPreferredRoleForCourse(courseId);
  if (preferredRole === "teacher") return buildCoursePath(courseId, "/teacher");
  if (preferredRole === "student") return buildCoursePath(courseId, "/student");
  return "/join-course";
};

export const getDefaultAppPath = (): string => {
  const user = getUser();
  if (!user) {
    return "/login";
  }

  const activeCourseId = getActiveCourseId();
  if (activeCourseId) {
    return getCourseHomePath(activeCourseId);
  }

  if (user.is_platform_admin) {
    return "/admin";
  }

  return "/join-course";
};
