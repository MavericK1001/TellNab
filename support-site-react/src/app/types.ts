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
  messages?: TicketMessage[];
};

export type TicketMessage = {
  id: string;
  ticketId?: string;
  senderId?: string;
  senderRole?: string;
  body: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  pending?: boolean;
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
