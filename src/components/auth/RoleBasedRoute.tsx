import { Navigate } from "react-router-dom";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export const RoleBasedRoute = ({ children, allowedRoles }: RoleBasedRouteProps) => {
  const { roles, loading, user } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasAccess = allowedRoles.some((role) => roles.includes(role));
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
