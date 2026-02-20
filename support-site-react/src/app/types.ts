export type SupportRole = "MEMBER" | "SUPPORT_MEMBER" | "MODERATOR" | "ADMIN" | string;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: SupportRole;
};

export type TicketRow = {
  id: string;
  ticket_number: string;
  subject: string;
  description?: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  assigned_agent_id?: string | null;
  customer_id?: string;
  sla_due_at: string;
  created_at?: string;
  updated_at?: string;
};

export type TicketMessage = {
  id: string;
  senderId?: string;
  senderRole?: string;
  body: string;
  createdAt: string;
};

export type TicketResponse = {
  data: TicketRow[];
  meta?: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type ApiError = {
  message?: string;
  issues?: { message?: string }[];
};
