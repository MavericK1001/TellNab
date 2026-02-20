import { ReactNode } from "react";

type Props = {
  sidebar: ReactNode;
  topbar: ReactNode;
  list: ReactNode;
  detail: ReactNode;
};

export function SupportLayout({ sidebar, topbar, list, detail }: Props) {
  return (
    <div className="support-shell">
      <aside className="support-sidebar">{sidebar}</aside>
      <section className="support-main">
        <header className="support-topbar">{topbar}</header>
        <div className="support-content">
          <div className="support-ticket-list">{list}</div>
          <aside className="support-ticket-detail">{detail}</aside>
        </div>
      </section>
    </div>
  );
}
