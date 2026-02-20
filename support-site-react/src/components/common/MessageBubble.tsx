type Props = {
  mine: boolean;
  body: string;
  timestamp?: string;
  senderLabel?: string;
  seen?: boolean;
};

export function MessageBubble({
  mine,
  body,
  timestamp,
  senderLabel,
  seen,
}: Props) {
  return (
    <div className={`message-row ${mine ? "mine" : "other"}`}>
      <div className="message-bubble">
        {senderLabel ? <p className="message-sender">{senderLabel}</p> : null}
        <p>{body}</p>
        <div className="message-meta">
          {timestamp ? (
            <time>{new Date(timestamp).toLocaleString()}</time>
          ) : null}
          {mine ? <span>{seen ? "Seen" : "Sent"}</span> : null}
        </div>
      </div>
    </div>
  );
}
