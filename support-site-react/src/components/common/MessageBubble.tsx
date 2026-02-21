type Props = {
  mine: boolean;
  body: string;
  timestamp?: string;
  senderLabel?: string;
  seen?: boolean;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  pending?: boolean;
};

export function MessageBubble({
  mine,
  body,
  timestamp,
  senderLabel,
  seen,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  pending,
}: Props) {
  const isImage = Boolean(fileUrl && (fileType || "").startsWith("image/"));

  return (
    <div className={`message-row ${mine ? "mine" : "other"}`}>
      <div className="message-bubble">
        {senderLabel ? <p className="message-sender">{senderLabel}</p> : null}
        <p>{body}</p>

        {fileUrl ? (
          isImage ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="attachment-image-wrap"
            >
              <img
                src={fileUrl}
                alt={fileName || "attachment"}
                className="attachment-image"
              />
            </a>
          ) : (
            <div className="attachment-file-card">
              <p className="attachment-name">{fileName || "Attachment"}</p>
              <p className="attachment-meta">
                {fileType || "file"} •{" "}
                {fileSize ? `${Math.ceil(fileSize / 1024)} KB` : "size n/a"}
              </p>
              <div className="support-btn-row">
                <a href={fileUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
                <a href={fileUrl} download={fileName || "attachment"}>
                  Download
                </a>
              </div>
            </div>
          )
        ) : null}

        <div className="message-meta">
          {timestamp ? (
            <time>{new Date(timestamp).toLocaleString()}</time>
          ) : null}
          {mine ? (
            <span>{pending ? "Sending..." : seen ? "Seen" : "Sent"}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
