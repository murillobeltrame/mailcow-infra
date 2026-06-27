import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { LoginPage } from "@/pages/login-page";
import { MailboxPage } from "@/pages/mailbox-page";
import { Skeleton } from "@/components/ui/skeleton";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MailboxPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
