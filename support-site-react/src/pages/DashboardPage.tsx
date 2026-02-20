import { FormEvent, useMemo, useState } from "react";
import { AuthUser, TicketMessage, TicketRow } from "../app/types";
import { AgentChatWidget } from "../components/agent-chat/AgentChatWidget";
import { Skeleton } from "../components/common/Skeleton";
import { StatCard } from "../components/common/StatCard";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { ChatWindow } from "../components/tickets/ChatWindow";
import { TicketCard } from "../components/tickets/TicketCard";

type Props = {
  user: AuthUser;
  authToken?: string | null;
  loading: boolean;
  status: string;
  tickets: TicketRow[];
  selectedTicketId: string;
  messages: TicketMessage[];
  roleOptions: string[];
  adminUsers: Array<{ id: string; name: string; email: string; role: string }>;
  onOpenTicket: (id: string) => void;
  onCreateTicket: (body: {
    subject: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }) => Promise<void>;
  onSendMessage: (ticketId: string, text: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onUpdateStatus: (ticketId: string, status: string) => Promise<void>;
  onRoleUpdate: (id: string, role: string) => Promise<void>;
  onLogout: () => void;
};

function resolveRoleView(user: AuthUser): "user" | "agent" | "admin" {
  const role = String(user.role || "").toUpperCase();
  if (role === "ADMIN") return "admin";
  if (role === "SUPPORT_MEMBER" || role === "MODERATOR") return "agent";
  return "user";
}

export function DashboardPage(props: Props) {
  const {
    user,
    authToken,
    loading,
    status,
    tickets,
    selectedTicketId,
    messages,
    roleOptions,
    adminUsers,
    onOpenTicket,
    onCreateTicket,
    onSendMessage,
    onRefresh,
    onUpdateStatus,
    onRoleUpdate,
    onLogout,
  } = props;

  const roleView = resolveRoleView(user);
  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId],
  );

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");

  const [queue, setQueue] = useState<"all" | "assigned" | "unassigned">("all");

  const filteredTickets = useMemo(() => {
    if (roleView === "agent") {
      if (queue === "assigned") {
        return tickets.filter((t) => t.assigned_agent_id === user.id);
      }
      if (queue === "unassigned") {
        return tickets.filter((t) => !t.assigned_agent_id);
      }
    }
    return tickets;
  }, [tickets, queue, roleView, user.id]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    await onCreateTicket({ subject, description, priority });
    setSubject("");
    setDescription("");
    setPriority("MEDIUM");
  }

  const openCount = tickets.filter((t) =>
    ["NEW", "OPEN", "PENDING"].includes(String(t.status).toUpperCase()),
  ).length;

  return (
    <div className="app-shell">
      <Sidebar user={user} roleView={roleView} onLogout={onLogout} />

      <main className="app-main">
        <Header
          title={
            roleView === "user"
              ? "User Dashboard"
              : roleView === "agent"
              ? "Agent Dashboard"
              : "Admin Dashboard"
          }
          subtitle="Modern support workspace powered by your existing APIs"
        />

        <section className="stats-grid">
          <StatCard label="Total tickets" value={tickets.length} />
          <StatCard label="Open tickets" value={openCount} />
          <StatCard label="My role" value={user.role} />
          <StatCard
            label="Queue"
            value={roleView === "agent" ? queue : "my_tickets"}
            hint="Real-time safe refresh"
          />
        </section>

        {roleView === "user" ? (
          <section className="panel">
            <h3>Create ticket</h3>
            <form className="grid" onSubmit={submitCreate}>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                minLength={5}
                required
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                minLength={10}
                required
              />
              <button type="submit">Create ticket</button>
            </form>
          </section>
        ) : null}

        <section className="workspace-grid">
          <section className="panel">
            <div className="list-head">
              <h3>{roleView === "agent" ? "Agent queue" : "Tickets"}</h3>
              <div className="support-btn-row">
                {roleView === "agent" ? (
                  <>
                    <button className="ghost" onClick={() => setQueue("all")}>
                      All
                    </button>
                    <button
                      className="ghost"
                      onClick={() => setQueue("assigned")}
                    >
                      Assigned
                    </button>
                    <button
                      className="ghost"
                      onClick={() => setQueue("unassigned")}
                    >
                      Unassigned
                    </button>
                  </>
                ) : null}
                <button className="ghost" onClick={() => onRefresh()}>
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <Skeleton lines={6} />
            ) : filteredTickets.length === 0 ? (
              <div className="empty-state">No tickets found in this queue.</div>
            ) : (
              <div className="ticket-list-modern">
                {filteredTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    selected={selectedTicketId === ticket.id}
                    onOpen={onOpenTicket}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="support-btn-row">
              <button
                className="ghost"
                disabled={!selected}
                onClick={() => selected && onUpdateStatus(selected.id, "OPEN")}
              >
                OPEN
              </button>
              <button
                className="ghost"
                disabled={!selected}
                onClick={() =>
                  selected && onUpdateStatus(selected.id, "PENDING")
                }
              >
                PENDING
              </button>
              <button
                className="ghost"
                disabled={!selected}
                onClick={() =>
                  selected && onUpdateStatus(selected.id, "RESOLVED")
                }
              >
                RESOLVED
              </button>
            </div>
            <ChatWindow
              ticket={selected}
              currentUser={user}
              messages={messages}
              onSend={(text) =>
                selected ? onSendMessage(selected.id, text) : Promise.resolve()
              }
              readOnly={!selected}
            />
          </section>
        </section>

        {roleView === "admin" ? (
          <section className="panel">
            <h3>Role Control</h3>
            <p className="subtle">Dynamic role rendering backed by API</p>
            <div className="admin-role-grid">
              {adminUsers.map((u) => (
                <article key={u.id} className="ticket-card">
                  <p>
                    <strong>{u.name}</strong>
                  </p>
                  <p className="subtle">{u.email}</p>
                  <select
                    value={u.role}
                    onChange={(e) => onRoleUpdate(u.id, e.target.value)}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {status ? <p className="status-message">{status}</p> : null}
      </main>

      <AgentChatWidget user={user} authToken={authToken} />
    </div>
  );
}
