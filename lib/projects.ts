import { DeliverableType, EditCause, ProjectCollaboratorRole, StudioAccessLevel, StudioArea, TaskPriority, TaskStatus, UserRole } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStudioAccessContext, hasStudioAccess } from "@/lib/studio-access";

export type ProjectCollaboratorItem = {
  id: string;
  role: ProjectCollaboratorRole;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

export type ProjectWorkspaceTask = {
  id: string;
  projectId?: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: Date | string | null;
  dueAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  assignees: Array<{
    userId: string;
    status: TaskStatus;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }>;
  specializations: Array<{
    specialization: string;
  }>;
  services: Array<{
    service: {
      id: string;
      name: string;
    };
  }>;
  deliverables: Array<{
    id: string;
    name: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    type: DeliverableType;
    version: number;
    createdAt: Date | string;
    uploadedBy: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: Date | string;
    author: {
      id: string;
      name: string | null;
      image: string | null;
      role: UserRole;
    };
  }>;
  ratings: Array<{
    id: string;
    score: number;
    feedback: string | null;
    clientId: string;
    createdAt: Date | string;
  }>;
  revisions: Array<{
    id: string;
    cause: EditCause;
    description: string;
    createdAt: Date | string;
    requestedBy: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
};

export type ProjectWorkspaceData = {
  project: {
    id: string;
    name: string;
    description: string | null;
    coverImage: string | null;
    targetAudience: string | null;
    keyMessage: string | null;
    imageryNote: string | null;
    startDate: Date | string | null;
    deadline: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    manager: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    client: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
    collaborators: ProjectCollaboratorItem[];
  };
  tasks: ProjectWorkspaceTask[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    doingTasks: number;
    toDoTasks: number;
    pendingTasks: number;
    toEditTasks: number;
    percentComplete: number;
    daysRemaining: number | null;
    deliverablesCount: number;
  };
  currentUserRole: UserRole;
  currentUserId: string;
  canManage: boolean;
};

export async function getProjectWorkspace(projectId: string): Promise<ProjectWorkspaceData> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized.");

  const userId = session.user.id;
  const userRole = session.user.role as UserRole;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      manager: {
        select: { id: true, name: true, email: true, image: true },
      },
      client: {
        select: { id: true, name: true, email: true, image: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        include: {
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          specializations: true,
          services: {
            include: {
              service: {
                select: { id: true, name: true },
              },
            },
          },
          deliverables: {
            include: {
              uploadedBy: {
                select: { id: true, name: true, image: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          comments: {
            include: {
              author: {
                select: { id: true, name: true, image: true, role: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          ratings: true,
          revisions: {
            include: {
              requestedBy: {
                select: { id: true, name: true, image: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!project) throw new Error("Project not found.");

  // Access validation:
  const isManager = project.managerId === userId;
  const isPrimaryClient = project.clientId === userId;
  const isCollaborator = project.collaborators.some((c) => c.userId === userId);

  let hasStudioAccessPerm = false;
  if (!isManager && (userRole === UserRole.MANAGER || userRole === UserRole.SUPERVISOR || userRole === UserRole.COLLABORATOR)) {
    const context = await getStudioAccessContext(userId, userRole);
    if (context && context.studioId === project.studioId && hasStudioAccess(context, StudioArea.PROJECTS, StudioAccessLevel.VIEW)) {
      hasStudioAccessPerm = true;
    }
  }

  const canAccess = isManager || isPrimaryClient || isCollaborator || hasStudioAccessPerm;
  if (!canAccess) {
    throw new Error("You do not have permission to view this project.");
  }

  const canManage = isManager || isPrimaryClient || hasStudioAccessPerm;

  // Compute metrics
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const doingTasks = project.tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
  const toDoTasks = project.tasks.filter((t) => t.status === TaskStatus.TODO).length;
  const pendingTasks = project.tasks.filter((t) => t.status === TaskStatus.PENDING).length;
  const toEditTasks = project.tasks.filter((t) => t.status === TaskStatus.TO_EDIT).length;

  const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  let daysRemaining: number | null = null;
  if (project.deadline) {
    const diff = new Date(project.deadline).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const deliverablesCount = project.tasks.reduce(
    (acc, t) => acc + t.deliverables.filter((d) => d.type === DeliverableType.OUTPUT).length,
    0
  );

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      coverImage: project.coverImage,
      targetAudience: project.targetAudience,
      keyMessage: project.keyMessage,
      imageryNote: project.imageryNote,
      startDate: project.startDate,
      deadline: project.deadline,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      manager: project.manager,
      client: project.client,
      collaborators: project.collaborators.map((c) => ({
        id: c.id,
        role: c.role,
        createdAt: c.createdAt,
        user: c.user,
      })),
    },
    tasks: project.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      startAt: t.startAt,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      assignees: t.assignees.map((a) => ({
        userId: a.userId,
        status: a.status,
        user: a.user,
      })),
      specializations: t.specializations.map((s) => ({
        specialization: s.specialization,
      })),
      services: t.services.map((s) => ({
        service: s.service,
      })),
      deliverables: t.deliverables.map((d) => ({
        id: d.id,
        name: d.name,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        type: d.type,
        version: d.version,
        createdAt: d.createdAt,
        uploadedBy: d.uploadedBy,
      })),
      comments: t.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: c.author,
      })),
      ratings: t.ratings.map((r) => ({
        id: r.id,
        score: r.score,
        feedback: r.feedback,
        clientId: r.clientId,
        createdAt: r.createdAt,
      })),
      revisions: t.revisions.map((rev) => ({
        id: rev.id,
        cause: rev.cause,
        description: rev.description,
        createdAt: rev.createdAt,
        requestedBy: rev.requestedBy,
      })),
    })),
    stats: {
      totalTasks,
      completedTasks,
      doingTasks,
      toDoTasks,
      pendingTasks,
      toEditTasks,
      percentComplete,
      daysRemaining,
      deliverablesCount,
    },
    currentUserRole: userRole,
    currentUserId: userId,
    canManage,
  };
}
