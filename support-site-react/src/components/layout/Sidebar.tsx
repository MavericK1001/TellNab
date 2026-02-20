import { AuthUser } from "../../app/types";

type Props = {
  user: AuthUser;
  onLogout: () => void;
  roleView: "user" | "agent" | "admin";
};

export function Sidebar({ user, onLogout, roleView }: Props) {
  return (
    <aside className="app-sidebar">
      <div>
        <p className="eyebrow">TellNab Support</p>
        <h2>{roleView.toUpperCase()} Workspace</h2>
        <p className="subtle">{user.name}</p>
        <p className="subtle">{user.role}</p>
      </div>

      <nav className="sidebar-nav">
        <button type="button" className="ghost">
          Dashboard
        </button>
        <button type="button" className="ghost">
          Tickets
        </button>
        <button type="button" className="ghost">
          Conversations
        </button>
        {roleView !== "user" ? (
          <button type="button" className="ghost">
            Agents
          </button>
        ) : null}
        {roleView === "admin" ? (
          <button type="button" className="ghost">
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
