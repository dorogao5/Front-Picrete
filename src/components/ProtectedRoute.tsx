import { Navigate } from "react-router-dom";
import { isAuthenticated, getUser } from "@/lib/auth";
import type { User } from "@/lib/auth";

type AllowedRole = User["role"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Allowed roles. If omitted, any authenticated user is allowed. */
  roles?: AllowedRole[];
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    const user = getUser();
    if (!user || !roles.includes(user.role)) {
      // Redirect to appropriate dashboard based on role
      if (user?.role === "admin") return <Navigate to="/admin" replace />;
      if (user?.role === "teacher") return <Navigate to="/teacher" replace />;
      return <Navigate to="/student" replace />;
    }
  }

  return <>{children}</>;
};
