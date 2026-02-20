import { TicketRow } from "../../app/types";
import { StatusBadge } from "../common/StatusBadge";

type Props = {
  ticket: TicketRow;
  selected: boolean;
  onOpen: (id: string) => void;
};

export function TicketCard({ ticket, selected, onOpen }: Props) {
  return (
    <button
      type="button"
      className={`ticket-card ${selected ? "selected" : ""}`}
      onClick={() => onOpen(ticket.id)}
    >
      <div className="ticket-card-top">
        <strong>{ticket.ticket_number}</strong>
        <StatusBadge value={ticket.status} tone="status" />
      </div>
      <p className="ticket-title">{ticket.subject}</p>
      <div className="ticket-card-top">
        <StatusBadge value={ticket.priority} tone="priority" />
        <small>{new Date(ticket.sla_due_at).toLocaleString()}</small>
      </div>
    </button>
  );
}
