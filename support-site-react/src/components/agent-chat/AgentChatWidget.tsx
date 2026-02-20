import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AuthUser } from "../../app/types";

type Peer = { id: string; name: string };
type Dm = { id: string; from: string; to: string; body: string; at: string };

const WS_URL = (window as any).SUPPORT_AGENT_CHAT_WS_URL || "";

function canUseAgentChat(user: AuthUser) {
  return ["SUPPORT_MEMBER", "MODERATOR", "ADMIN"].includes(
    String(user.role).toUpperCase(),
  );
}

export function AgentChatWidget({
  user,
  authToken,
}: {
  user: AuthUser;
  authToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activePeerId, setActivePeerId] = useState<string>("");
  const [messages, setMessages] = useState<Dm[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!canUseAgentChat(user) || !WS_URL) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: "auth",
          token: authToken || null,
          userId: user.id,
          role: user.role,
          name: user.name,
        }),
      );
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data || "{}"));

        if (msg.type === "presence" && Array.isArray(msg.agents)) {
          setPeers(msg.agents);
          if (!activePeerId && msg.agents[0]?.id) {
            setActivePeerId(msg.agents[0].id);
          }
          return;
        }

        if (msg.type === "dm") {
          const dm: Dm = {
            id: msg.id || crypto.randomUUID(),
            from: msg.from,
            to: msg.to,
            body: msg.body,
            at: msg.at || new Date().toISOString(),
          };
          setMessages((prev) => [...prev, dm]);
          if (!open) {
            setUnread((n) => n + 1);
            const audio = new Audio(
              "data:audio/wav;base64,UklGRjwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRgAAAAA/////wAAAP///wAAAA==",
            );
            audio.play().catch(() => undefined);
          }
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      ws.close();
    };
  }, [authToken, user.id, user.name, user.role, open, activePeerId]);

  const activePeer = peers.find((p) => p.id === activePeerId) || null;
  const thread = useMemo(
    () =>
      messages.filter((m) => m.from === activePeerId || m.to === activePeerId),
    [messages, activePeerId],
  );

  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || !activePeerId || !wsRef.current) return;

    wsRef.current.send(
      JSON.stringify({
        type: "dm",
        to: activePeerId,
        body: draft.trim(),
      }),
    );

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
