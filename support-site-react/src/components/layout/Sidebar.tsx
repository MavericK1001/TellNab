import { AuthUser } from "../../app/types";

type Props = {
  user: AuthUser;
  onLogout: () => void;
  roleView: "user" | "agent" | "admin";
  activeSection: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
};

export function Sidebar({
  user,
  onLogout,
  roleView,
  activeSection,
  isOpen,
  onClose,
  onNavigate,
}: Props) {
  function nav(section: string) {
    onNavigate(section);
    onClose();
  }

  return (
    <aside className={`app-sidebar ${isOpen ? "open" : ""}`}>
      <button type="button" className="mobile-close-btn" onClick={onClose}>
        ✕
      </button>
      <div>
        <p className="eyebrow">TellNab Support</p>
        <h2>{roleView.toUpperCase()} Workspace</h2>
        <p className="subtle">{user.name}</p>
        <p className="subtle">{user.role}</p>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={`ghost ${
            activeSection === "dashboard" ? "active-tab" : ""
          }`}
          onClick={() => nav("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`ghost ${activeSection === "tickets" ? "active-tab" : ""}`}
          onClick={() => nav("tickets")}
        >
          Tickets
        </button>
        <button
          type="button"
          className={`ghost ${
            activeSection === "conversations" ? "active-tab" : ""
          }`}
          onClick={() => nav("conversations")}
        >
          Conversations
        </button>
        {roleView !== "user" ? (
          <button
            type="button"
            className={`ghost ${
              activeSection === "agents" ? "active-tab" : ""
            }`}
            onClick={() => nav("agents")}
          >
            Agents
          </button>
        ) : null}
        {roleView === "admin" ? (
          <button
            type="button"
            className={`ghost ${
              activeSection === "role-control" ? "active-tab" : ""
            }`}
            onClick={() => nav("role-control")}
          >
            Role Control
          </button>
        ) : null}
      </nav>

      <button type="button" onClick={onLogout}>
        Sign out
      </button>
    </aside>
  );
}
