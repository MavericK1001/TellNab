import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthUser } from "./types";

type AgentPresence = { id: string; name: string; role?: string };
type TicketSocketMessage = {
  id: string;
  ticketId: string;
  senderId?: string;
  senderRole?: string;
  body: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

type AgentDm = {
  id: string;
  from: string;
  to: string;
  body: string;
  at: string;
};

type SocketContextValue = {
  connected: boolean;
  onlineAgents: AgentPresence[];
  setAuth: (user: AuthUser | null, token?: string | null) => void;
  joinTicketRoom: (ticketId: string) => void;
  emitTicketMessage: (message: TicketSocketMessage) => void;
  subscribeTicketMessages: (
    ticketId: string,
    cb: (message: TicketSocketMessage) => void,
  ) => () => void;
  sendAgentDm: (to: string, body: string) => void;
  subscribeAgentDm: (cb: (message: AgentDm) => void) => () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

function resolveWsUrls() {
  const toWsFromHttp = (value: string) => {
    try {
      const parsed = new URL(value, window.location.origin);
      const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${parsed.host}/ws`;
    } catch {
      return "";
    }
  };

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const explicitRaw = String(
    (window as any).SUPPORT_WS_URL ||
      (window as any).SUPPORT_AGENT_CHAT_WS_URL ||
      "",
  ).trim();

  const apiBase = String((window as any).SUPPORT_API_BASE || "").trim();
  const isSupportHost = /(^|\.)support\.tellnab\.com$/i.test(
    window.location.hostname,
  );
  const explicit = (() => {
    if (!explicitRaw) return "";
    if (!isSupportHost) return explicitRaw;
    try {
      const parsed = new URL(explicitRaw, window.location.origin);
      if (
        /(^|\.)support\.tellnab\.com$/i.test(parsed.hostname) ||
        !/(^|\.)tellnab\.onrender\.com$/i.test(parsed.hostname)
      ) {
        return "";
      }
    } catch {
      // ignore parse issue and keep explicit as-is
    }
    return explicitRaw;
  })();

  if (isSupportHost) {
    return Array.from(
      new Set(["wss://tellnab.onrender.com/ws", explicit].filter(Boolean)),
    );
  }

  return Array.from(
    new Set(
      [
        explicit,
        toWsFromHttp(apiBase),
        ...(!isSupportHost ? [`${protocol}//${window.location.host}/ws`] : []),
        ...(!isSupportHost
          ? ["wss://tellnab.com/ws", "wss://tellnab.onrender.com/ws"]
          : []),
      ].filter(Boolean),
    ),
  );
}

const WS_URLS = resolveWsUrls();

function withSocketAuth(
  url: string,
  auth: { token?: string | null; userId?: string; role?: string },
) {
  const token = String(auth.token || "").trim();
  const userId = String(auth.userId || "").trim();
  const role = String(auth.role || "").trim();
  if (!token && !userId) return url;

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (userId) params.set("userId", userId);
  if (role) params.set("role", role);

  return `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
}

export function SocketProvider({ children }: PropsWithChildren) {
  const [connected, setConnected] = useState(false);
  const [onlineAgents, setOnlineAgents] = useState<AgentPresence[]>([]);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const joinedTicketIdsRef = useRef<Set<string>>(new Set());
  const wsUrlIndexRef = useRef(0);

  const ticketListenersRef = useRef<
    Map<string, Set<(message: TicketSocketMessage) => void>>
  >(new Map());
  const dmListenersRef = useRef<Set<(message: AgentDm) => void>>(new Set());

  const connect = useCallback(() => {
    if (!WS_URLS.length || !authUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      setOnlineAgents([]);
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const metaToken = (wsRef.current as any).__authToken;
      const metaUserId = (wsRef.current as any).__authUserId;
      if (metaToken === (authToken || "") && metaUserId === authUser.id) {
        return;
      }
      wsRef.current.close();
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const wsBaseUrl = WS_URLS[wsUrlIndexRef.current % WS_URLS.length];
    const wsUrl = withSocketAuth(wsBaseUrl, {
      token: authToken,
      userId: authUser.id,
      role: authUser.role,
    });
    const ws = new WebSocket(wsUrl);
    (ws as any).__authToken = authToken || "";
    (ws as any).__authUserId = authUser.id;
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(
        JSON.stringify({
          type: "auth",
          token: authToken || null,
          userId: authUser.id,
          role: authUser.role,
          name: authUser.name,
        }),
      );

      ws.send(
        JSON.stringify({
          type: "agent_online",
          userId: authUser.id,
        }),
      );

      joinedTicketIdsRef.current.forEach((ticketId) => {
        ws.send(JSON.stringify({ type: "join_ticket_room", ticketId }));
      });
    };

    ws.onclose = () => {
      setConnected(false);
      if (WS_URLS.length > 1) {
        wsUrlIndexRef.current = (wsUrlIndexRef.current + 1) % WS_URLS.length;
      }
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(connect, 1500);
    };

    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));

        if (
          (payload.type === "presence" || payload.type === "presence_update") &&
          Array.isArray(payload.agents)
        ) {
          setOnlineAgents(payload.agents);
          return;
        }

        if (
          payload.type === "ticket_message_received" ||
          payload.type === "ticket.message"
        ) {
          const message: TicketSocketMessage = {
            id: payload.id || crypto.randomUUID(),
            ticketId: payload.ticketId,
            senderId: payload.senderId,
            senderRole: payload.senderRole,
            body: payload.body,
            createdAt: payload.createdAt || new Date().toISOString(),
            fileUrl: payload.fileUrl,
            fileName: payload.fileName,
            fileType: payload.fileType,
            fileSize: payload.fileSize,
          };

          const listeners = ticketListenersRef.current.get(message.ticketId);
          listeners?.forEach((cb) => cb(message));
          return;
        }

        if (
          payload.type === "private_message_received" ||
          payload.type === "dm"
        ) {
          const dm: AgentDm = {
            id: payload.id || crypto.randomUUID(),
            from: payload.from,
            to: payload.to,
            body: payload.body,
            at: payload.at || new Date().toISOString(),
          };
          dmListenersRef.current.forEach((cb) => cb(dm));
        }
      } catch {
        // ignore malformed socket payload
      }
    };
  }, [authToken, authUser]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const setAuth = useCallback(
    (user: AuthUser | null, token?: string | null) => {
      setAuthUser(user);
      setAuthToken(token || null);
    },
    [],
  );

  const joinTicketRoom = useCallback((ticketId: string) => {
    const roomId = String(ticketId || "").trim();
    if (!roomId) return;
    joinedTicketIdsRef.current.add(roomId);
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "join_ticket_room", ticketId: roomId }),
    );
  }, []);

  const emitTicketMessage = useCallback((message: TicketSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "ticket_message_sent", ...message }),
    );
  }, []);

  const subscribeTicketMessages = useCallback(
    (ticketId: string, cb: (message: TicketSocketMessage) => void) => {
      const map = ticketListenersRef.current;
      if (!map.has(ticketId)) map.set(ticketId, new Set());
      map.get(ticketId)?.add(cb);

      return () => {
        const set = map.get(ticketId);
        set?.delete(cb);
        if (set && set.size === 0) {
          map.delete(ticketId);
        }
      };
    },
    [],
  );

  const sendAgentDm = useCallback((to: string, body: string) => {
    if (!to || !body.trim()) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({ type: "private_message_sent", to, body: body.trim() }),
    );
  }, []);

  const subscribeAgentDm = useCallback((cb: (message: AgentDm) => void) => {
    dmListenersRef.current.add(cb);
    return () => {
      dmListenersRef.current.delete(cb);
    };
  }, []);

  const value = useMemo<SocketContextValue>(
    () => ({
      connected,
      onlineAgents,
      setAuth,
      joinTicketRoom,
      emitTicketMessage,
      subscribeTicketMessages,
      sendAgentDm,
      subscribeAgentDm,
    }),
    [
      connected,
      onlineAgents,
      setAuth,
      joinTicketRoom,
      emitTicketMessage,
      subscribeTicketMessages,
      sendAgentDm,
      subscribeAgentDm,
    ],
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
