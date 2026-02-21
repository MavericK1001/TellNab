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
import { SocketProvider, useSocket } from "./app/SocketContext";
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
  sendTicketMessagePayload,
  uploadSupportAttachment,
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
  const [bootstrapping, setBootstrapping] = useState(true);
  const [adminUsers, setAdminUsers] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([
    "MEMBER",
    "SUPPORT_MEMBER",
    "MODERATOR",
    "ADMIN",
  ]);
  const {
    setAuth,
    joinTicketRoom,
    subscribeTicketMessages,
  } = useSocket();

  useEffect(() => {
    setAuth(authUser, authToken);
  }, [authUser, authToken, setAuth]);

  async function refreshAllFor(user: AuthUser, token?: string | null) {
    setLoading(true);
    try {
      const [ticketData, rolesData, adminData] = await Promise.all([
        listTickets(token),
        getRoles(token).catch(() => null),
        String(user.role).toUpperCase() === "ADMIN"
          ? getAdminUsers(token).catch(() => null)
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

  useEffect(() => {
    (async () => {
      const me = await getSessionUser(authToken).catch(() => null);
      if (me) {
        setAuthUser(me);
        await refreshAllFor(me, authToken);
        if (location.pathname === "/login") {
          navigate("/dashboard", { replace: true });
        }
      }
      setBootstrapping(false);
    })();
  }, []);

  useEffect(() => {
    if (!tickets.length) return;

    const unsubscribers = tickets.map((ticket) => {
      joinTicketRoom(ticket.id);
      return subscribeTicketMessages(ticket.id, (msg) => {
        setMessagesByTicket((prev) => {
          const existing = prev[ticket.id] || [];
          if (existing.some((m) => m.id === msg.id)) {
            return prev;
          }
          return {
            ...prev,
            [ticket.id]: [...existing, msg],
          };
        });
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [joinTicketRoom, subscribeTicketMessages, tickets]);

  const selectedMessages = useMemo(
    () => messagesByTicket[selectedTicketId] || [],
    [messagesByTicket, selectedTicketId],
  );

  async function refreshAll() {
    if (!authUser) return;
    await refreshAllFor(authUser, authToken);
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
      await refreshAllFor(user, token);
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
      await refreshAllFor(user, authToken);
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

  async function handleSendMessage(
    ticketId: string,
    payload: { text: string; file?: File | null },
  ) {
    const temporaryId = `tmp-${Date.now()}`;
    const now = new Date().toISOString();
    const baseMessage: TicketMessage = {
      id: temporaryId,
      ticketId,
      senderId: authUser?.id,
      senderRole: authUser?.role,
      body:
        payload.text ||
        (payload.file ? `Attachment: ${payload.file.name}` : ""),
      createdAt: now,
      pending: true,
    };

    if (payload.file) {
      baseMessage.fileName = payload.file.name;
      baseMessage.fileType = payload.file.type;
      baseMessage.fileSize = payload.file.size;
      baseMessage.fileUrl = URL.createObjectURL(payload.file);
    }

    setMessagesByTicket((prev) => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), baseMessage],
    }));

    try {
      let attachment:
        | {
            fileUrl: string;
            fileName: string;
            fileType: string;
            fileSize: number;
          }
        | undefined;

      if (payload.file) {
        attachment = await uploadSupportAttachment(payload.file, authToken);
      }

      const response = await sendTicketMessagePayload(
        ticketId,
        {
          body:
            payload.text ||
            (attachment ? `Attachment: ${attachment.fileName}` : ""),
          fileUrl: attachment?.fileUrl,
          fileName: attachment?.fileName,
          fileType: attachment?.fileType,
          fileSize: attachment?.fileSize,
        },
        authToken,
      );
      const msg = response.data;

      setMessagesByTicket((prev) => ({
        ...prev,
        [ticketId]: (prev[ticketId] || []).map((m) =>
          m.id === temporaryId
            ? {
                ...msg,
                fileUrl: attachment?.fileUrl,
                fileName: attachment?.fileName,
                fileType: attachment?.fileType,
                fileSize: attachment?.fileSize,
                pending: false,
              }
            : m,
        ),
      }));

      setStatus("Reply sent.");
    } catch (error) {
      setMessagesByTicket((prev) => ({
        ...prev,
        [ticketId]: (prev[ticketId] || []).filter((m) => m.id !== temporaryId),
      }));
      setStatus(
        error instanceof Error ? error.message : "Failed to send message.",
      );
    }
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
      {bootstrapping ? (
        <div className="loading-fullscreen">Loading session…</div>
      ) : (
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
            element={
              <Navigate to={authUser ? "/dashboard" : "/login"} replace />
            }
          />
        </Routes>
      )}
    </Suspense>
  );
}

export default function SupportApp() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </SocketProvider>
  );
}
