type Props = {
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  assignedAgent?: string | null;
  slaDueAt: string;
};

export function TicketDetailPanel(props: Props) {
  return (
    <section>
      <header>
        <p>{props.ticketNumber}</p>
        <h3>{props.subject}</h3>
        <p>
          {props.status} • {props.priority}
        </p>
        <p>Assigned: {props.assignedAgent || "Unassigned"}</p>
        <p>SLA: {new Date(props.slaDueAt).toLocaleString()}</p>
      </header>
      <div>{/* Chat thread */}</div>
      <aside>{/* Properties + internal notes + activity timeline */}</aside>
    </section>
  );
}
