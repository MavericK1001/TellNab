import { FormEvent, useMemo, useState } from "react";
import { AuthUser, TicketMessage, TicketRow } from "../../app/types";
import { MessageBubble } from "../common/MessageBubble";

type Props = {
  ticket: TicketRow | null;
  currentUser: AuthUser;
  messages: TicketMessage[];
  onSend: (payload: { text: string; file?: File | null }) => Promise<void>;
  readOnly?: boolean;
};

export function ChatWindow({
  ticket,
  currentUser,
  messages,
  onSend,
  readOnly,
}: Props) {
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const thread = useMemo(() => {
    if (!ticket) return [];
    const seed: TicketMessage[] = ticket.description
      ? [
          {
            id: `${ticket.id}-seed`,
            body: ticket.description,
            senderId: ticket.customer_id,
            senderRole: "MEMBER",
            createdAt:
              ticket.created_at ||
              ticket.updated_at ||
              new Date().toISOString(),
          },
        ]
      : [];
    return [...seed, ...messages];
  }, [ticket, messages]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if ((!draft.trim() && !file) || readOnly) return;
    setSending(true);
    await onSend({ text: draft.trim(), file });
    setSending(false);
    setDraft("");
    setFile(null);
  }

  if (!ticket) {
    return (
      <section className="chat-window empty-state">
        Select a ticket to view conversation.
      </section>
    );
  }

  return (
    <section className="chat-window">
      <div className="chat-window-header">
        <h3>{ticket.subject}</h3>
        <p className="subtle">{ticket.ticket_number}</p>
      </div>

      <div className="chat-thread">
        {thread.length === 0 ? (
          <p className="subtle">No messages yet.</p>
        ) : (
          thread.map((msg) => (
            <MessageBubble
              key={msg.id}
              mine={msg.senderId === currentUser.id}
              body={msg.body}
              timestamp={msg.createdAt}
              fileUrl={msg.fileUrl}
              fileName={msg.fileName}
              fileType={msg.fileType}
              fileSize={msg.fileSize}
              pending={msg.pending}
              senderLabel={
                msg.senderId === currentUser.id
                  ? "You"
                  : msg.senderRole || "Agent"
              }
              seen
            />
          ))
        )}
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={readOnly ? "Read-only" : "Type a message..."}
          disabled={readOnly || sending}
        />

        <div className="chat-attach-row">
          <label className="attach-pill attach-input-label">
            Attach file
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={readOnly || sending}
            />
          </label>
          {file ? (
            <span className="subtle file-preview-name">{file.name}</span>
          ) : null}
          {sending ? <span className="subtle">Uploading...</span> : null}
        </div>

        <div className="chat-actions">
          <span className="attach-pill">
            {file ? "Attachment ready" : "No attachment"}
          </span>
          <button
            type="submit"
            disabled={readOnly || sending || (!draft.trim() && !file)}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
