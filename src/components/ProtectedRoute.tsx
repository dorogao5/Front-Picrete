import { Navigate, useParams } from "react-router-dom";

import {
  getDefaultAppPath,
  getMembershipForCourse,
  hasCourseRole,
  isAdmin,
  isAuthenticated,
} from "@/lib/auth";

type AllowedRole = "admin" | "teacher" | "student";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles. If omitted, any authenticated user is allowed. */
  roles?: AllowedRole[];
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const { courseId } = useParams<{ courseId?: string }>();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!roles || roles.length === 0) {
    return <>{children}</>;
  }

  if (!courseId) {
    if (roles.includes("admin") && isAdmin()) {
      return <>{children}</>;
    }
    return <Navigate to={getDefaultAppPath()} replace />;
  }

  const membership = getMembershipForCourse(courseId);
  if (!membership && !isAdmin()) {
    return <Navigate to="/join-course" replace />;
  }

  const allowed = roles.some((role) => {
    if (role === "admin") return isAdmin();
    return hasCourseRole(courseId, role);
  });

  if (!allowed) {
    return <Navigate to={getDefaultAppPath()} replace />;
  }

  return <>{children}</>;
};
