export type InvitationRole = "WORKER" | "CLIENT";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED";

export type PrototypeInvitation = {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  invitedAt: string;
  expiresAt: string;
  usedAt?: string;
  token: string;
  recipientName?: string;
  clientProject?: string;
  specialization?: string[];
};

export type PrototypeVersion = "version-a" | "version-b" | "version-c" | "version-d";
