import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthUser, TicketMessage, TicketRow } from "./app/types";
import {
  clearStoredSupportToken,
  createTicket,
  getAdminUsers,
  getRoles,
  getSessionUser,
  getStoredSupportToken,
  listTickets,
  loginSupport,
  patchUserRole,
  sendTicketMessage,
  updateTicket,
} from "./services/supportApi";

const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    getStoredSupportToken(),
  );
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [messagesByTicket, setMessagesByTicket] = useState<
    Record<string, TicketMessage[]>
  >({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([
    "MEMBER",
    "SUPPORT_MEMBER",
    "MODERATOR",
    "ADMIN",
  ]);

  useEffect(() => {
    (async () => {
      const me = await getSessionUser(authToken).catch(() => null);
      if (me) {
        setAuthUser(me);
        if (location.pathname === "/login") {
          navigate("/dashboard", { replace: true });
        }
      }
    })();
  }, []);

  const selectedMessages = useMemo(
    () => messagesByTicket[selectedTicketId] || [],
    [messagesByTicket, selectedTicketId],
  );

  async function refreshAll() {
    if (!authUser) return;
    setLoading(true);
    try {
      const [ticketData, rolesData, adminData] = await Promise.all([
        listTickets(authToken),
        getRoles(authToken).catch(() => null),
        String(authUser.role).toUpperCase() === "ADMIN"
          ? getAdminUsers(authToken).catch(() => null)
          : Promise.resolve(null),
      ]);

      const rows = Array.isArray(ticketData?.data) ? ticketData.data : [];
      setTickets(rows);
      setSelectedTicketId((prev) => prev || rows[0]?.id || "");

      if (rolesData) {
        const dynamicRoles = (rolesData.roles || rolesData.data || [])
          .map((r) => r.key || r.name)
          .filter(Boolean);
        if (dynamicRoles.length)
          setRoleOptions(Array.from(new Set(dynamicRoles)));
      }

      if (adminData?.users) {
        setAdminUsers(adminData.users);
      }

      setStatus(`Loaded ${rows.length} tickets.`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    setLoading(true);
    try {
      const login = await loginSupport(email, password);
      const token = login.token || getStoredSupportToken();
      setAuthToken(token);

      const user = login.user || (await getSessionUser(token));
      if (!user) throw new Error("Login succeeded but session is unavailable.");

      setAuthUser(user);
      setStatus(`Signed in as ${user.name}`);
      navigate("/dashboard", { replace: true });
      await refreshAll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUseSession() {
    setLoading(true);
    try {
      const user = await getSessionUser(authToken);
      if (!user) {
        setStatus("No active session found.");
        return;
      }
      setAuthUser(user);
      navigate("/dashboard", { replace: true });
      await refreshAll();
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket(body: {
    subject: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }) {
    await createTicket(body, authToken);
    await refreshAll();
    setStatus("Ticket created.");
  }

  async function handleSendMessage(ticketId: string, text: string) {
    const res = await sendTicketMessage(ticketId, text, authToken);
    const msg = res.data;
    setMessagesByTicket((prev) => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), msg],
    }));
    setStatus("Reply sent.");
  }

  async function handleUpdateStatus(ticketId: string, nextStatus: string) {
    await updateTicket(ticketId, { status: nextStatus }, authToken);
    await refreshAll();
    setStatus(`Ticket marked ${nextStatus}.`);
  }

  async function handleRoleUpdate(userId: string, role: string) {
    await patchUserRole(userId, role, authToken);
    await refreshAll();
    setStatus("Role updated.");
  }

  function handleLogout() {
    clearStoredSupportToken();
    setAuthToken(null);
    setAuthUser(null);
    setTickets([]);
    setMessagesByTicket({});
    navigate("/login", { replace: true });
  }

  return (
    <Suspense fallback={<div className="loading-fullscreen">Loading…</div>}>
      <Routes>
        <Route
          path="/login"
          element={
            <LoginPage
              loading={loading}
              status={status}
              onSubmit={handleLogin}
              onUseSession={handleUseSession}
            />
          }
        />

        <Route
          path="/dashboard"
          element={
            authUser ? (
              <DashboardPage
                user={authUser}
                authToken={authToken}
                loading={loading}
                status={status}
                tickets={tickets}
                selectedTicketId={selectedTicketId}
                messages={selectedMessages}
                roleOptions={roleOptions}
                adminUsers={adminUsers}
                onOpenTicket={setSelectedTicketId}
                onCreateTicket={handleCreateTicket}
                onSendMessage={handleSendMessage}
                onRefresh={refreshAll}
                onUpdateStatus={handleUpdateStatus}
                onRoleUpdate={handleRoleUpdate}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="*"
          element={<Navigate to={authUser ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Suspense>
  );
}

export default function SupportApp() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
