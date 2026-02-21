type Props = {
  title: string;
  subtitle: string;
  connected?: boolean;
  onToggleSidebar?: () => void;
};

export function Header({
  title,
  subtitle,
  connected = false,
  onToggleSidebar,
}: Props) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="mobile-menu-btn"
        onClick={onToggleSidebar}
      >
        ☰
      </button>
      <div>
        <h1>{title}</h1>
        <p className="subtle">{subtitle}</p>
      </div>
      <div className="live-status-wrap">
        <div className={`live-avatar ${connected ? "online" : "offline"}`}>
          <span className="live-dot" />
        </div>
        <div className="online-pill">{connected ? "Online" : "Offline"}</div>
      </div>
    </header>
  );
}
