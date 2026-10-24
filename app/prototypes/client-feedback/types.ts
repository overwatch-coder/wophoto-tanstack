export type FeedbackType = "REVIEW" | "REVISION" | "COMPLAINT" | "DELIVERY";
export type FeedbackStatus = "NEW" | "IN_REVIEW" | "RESOLVED";

export type ClientFeedbackItem = {
  id: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskTitle?: string;
  clientName: string;
  clientEmail: string;
  type: FeedbackType;
  status: FeedbackStatus;
  score: number; // 1-5
  title: string;
  details: string;
  createdAt: string;
  managerResponse?: {
    authorName: string;
    note: string;
    respondedAt: string;
  };
};

export type ClientDeliverable = {
  id: string;
  title: string;
  status: "COMPLETED" | "IN_REVIEW" | "IN_PROGRESS" | "TODO";
  format: string;
  photoCount: number;
  previewColor?: string;
};

export type ClientProjectSummary = {
  id: string;
  name: string;
  category: "Fashion" | "Wedding" | "Commercial" | "Editorial";
  totalDeliverables: number;
  completedDeliverables: number;
  leadPhotographer: string;
  status: "IN_PRODUCTION" | "READY_FOR_REVIEW" | "COMPLETED";
  deliverables: ClientDeliverable[];
};

export type PrototypeVersion = "version-a" | "version-b" | "version-c";
