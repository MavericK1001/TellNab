import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthUser } from "../../app/types";
import { useSocket } from "../../app/SocketContext";

type Peer = { id: string; name: string; role?: string };
type Dm = { id: string; from: string; to: string; body: string; at: string };

function canUseAgentChat(user: AuthUser) {
  return ["SUPPORT_MEMBER", "MODERATOR", "ADMIN"].includes(
    String(user.role).toUpperCase(),
  );
}

export function AgentChatWidget({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activePeerId, setActivePeerId] = useState<string>("");
  const [messages, setMessages] = useState<Dm[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const { connected, onlineAgents, subscribeAgentDm, sendAgentDm } =
    useSocket();

  useEffect(() => {
    if (!canUseAgentChat(user)) return;

    const unsub = subscribeAgentDm((msg) => {
      const dm: Dm = {
        id: msg.id,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        at: msg.at,
      };
      setMessages((prev) => [...prev, dm]);
      if (!open) {
        setUnread((n) => n + 1);
        const audio = new Audio(
          "data:audio/wav;base64,UklGRjwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRgAAAAA/////wAAAP///wAAAA==",
        );
        audio.play().catch(() => undefined);
      }
    });

    return () => {
      unsub();
    };
  }, [open, subscribeAgentDm, user.id, user.role]);

  useEffect(() => {
    const otherAgents = onlineAgents.filter((agent) => agent.id !== user.id);
    setPeers(otherAgents);
    if (!activePeerId && otherAgents[0]?.id) {
      setActivePeerId(otherAgents[0].id);
    }
  }, [activePeerId, onlineAgents, user.id]);

  const activePeer = peers.find((p) => p.id === activePeerId) || null;
  const thread = useMemo(
    () =>
      messages.filter((m) => m.from === activePeerId || m.to === activePeerId),
    [messages, activePeerId],
  );

  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !activePeerId) return;

    sendAgentDm(activePeerId, draft.trim());

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        from: user.id,
        to: activePeerId,
        body: draft.trim(),
        at: new Date().toISOString(),
      },
    ]);

    setDraft("");
  }

  if (!canUseAgentChat(user)) return null;

  return (
    <div className="agent-chat-fab-wrap">
      <button
        type="button"
        className="agent-chat-fab"
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
      >
        Agent Chat{" "}
        {unread > 0 ? <span className="unread-pill">{unread}</span> : null}
      </button>

      {open ? (
        <section className="agent-chat-panel">
          <header>
            <strong>Internal Agent Chat</strong>
            <small className={connected ? "ok" : "error"}>
              {connected ? "Online" : "Offline"}
            </small>
          </header>

          <div className="agent-chat-body">
            <aside>
              {peers.length === 0 ? (
                <p className="subtle">No online agents</p>
              ) : null}
              {peers.map((peer) => (
                <button
                  key={peer.id}
                  className="ghost"
                  onClick={() => setActivePeerId(peer.id)}
                >
                  {peer.name}
                </button>
              ))}
            </aside>

            <div>
              <p className="subtle">
                {activePeer
                  ? `Chat with ${activePeer.name}`
                  : "Select an agent"}
              </p>
              <div className="agent-thread">
                {thread.map((m) => (
                  <p
                    key={m.id}
                    className={m.from === user.id ? "mine" : "other"}
                  >
                    {m.body}
                  </p>
                ))}
              </div>
              <form onSubmit={send} className="agent-chat-input">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                />
                <button type="submit" disabled={!activePeerId}>
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
