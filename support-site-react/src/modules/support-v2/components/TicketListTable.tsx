type TicketRow = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  assigned_agent_id?: string | null;
  sla_due_at: string;
};

type Props = {
  rows: TicketRow[];
  onOpen: (id: string) => void;
};

export function TicketListTable({ rows, onOpen }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Ticket</th>
          <th>Subject</th>
          <th>Status</th>
          <th>Priority</th>
          <th>SLA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onOpen(row.id)}>
            <td>{row.ticket_number}</td>
            <td>{row.subject}</td>
            <td>{row.status}</td>
            <td>{row.priority}</td>
            <td>{new Date(row.sla_due_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
