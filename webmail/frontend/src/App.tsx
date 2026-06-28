import { AppShell } from "@/components/portal/app-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AccountPage } from "@/pages/account-page";
import { AdminPage } from "@/pages/admin-page";
import { CalendarPage } from "@/pages/calendar-page";
import { ContactsPage } from "@/pages/contacts-page";
import { DomainPage } from "@/pages/domain-page";
import { GuestRoute } from "@/components/auth/protected-route";
import { LoginPage } from "@/pages/login-page";
import { MailboxPage } from "@/pages/mailbox-page";
import { Navigate, Route, Routes } from "react-router-dom";

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route
          path="/"
          element={
            <ProtectedRoute roles={["user"]}>
              <MailboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute roles={["user"]}>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute roles={["user"]}>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute roles={["user"]}>
              <ContactsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/domain"
          element={
            <ProtectedRoute roles={["domainadmin", "admin"]}>
              <DomainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
