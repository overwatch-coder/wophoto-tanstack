CREATE TABLE "StudioService" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudioService_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskService" (
  "taskId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "TaskService_pkey" PRIMARY KEY ("taskId", "serviceId")
);

CREATE UNIQUE INDEX "StudioService_studioId_name_key" ON "StudioService"("studioId", "name");
CREATE INDEX "StudioService_studioId_isActive_name_idx" ON "StudioService"("studioId", "isActive", "name");
CREATE INDEX "TaskService_serviceId_taskId_idx" ON "TaskService"("serviceId", "taskId");

ALTER TABLE "StudioService" ADD CONSTRAINT "StudioService_studioId_fkey"
  FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskService" ADD CONSTRAINT "TaskService_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskService" ADD CONSTRAINT "TaskService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "StudioService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH defaults(key, name) AS (VALUES
  ('PHOTOGRAPHY', 'Photography'),
  ('VIDEOGRAPHY', 'Videography'),
  ('CONTENT_CREATION', 'Content Creation'),
  ('GRAPHIC_DESIGN', 'Graphic Design'),
  ('WEB_CREATION', 'Web Creation'),
  ('POST_PRODUCTION', 'Post Production')
)
INSERT INTO "StudioService" ("id", "studioId", "name", "isActive", "createdAt", "updatedAt")
SELECT 'studio_service_' || substr(md5(s."id" || ':' || d.key), 1, 24), s."id", d.name, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Studio" s CROSS JOIN defaults d;

WITH mapping(specialization, name) AS (VALUES
  ('PHOTOGRAPHY', 'Photography'),
  ('VIDEOGRAPHY', 'Videography'),
  ('CONTENT_CREATION', 'Content Creation'),
  ('GRAPHIC_DESIGN', 'Graphic Design'),
  ('WEB_CREATION', 'Web Creation')
)
INSERT INTO "TaskService" ("taskId", "serviceId")
SELECT DISTINCT ts."taskId", service."id"
FROM "TaskSpecialization" ts
JOIN "Task" t ON t."id" = ts."taskId"
JOIN "Project" p ON p."id" = t."projectId"
JOIN mapping m ON m.specialization = ts."specialization"::text
JOIN "StudioService" service ON service."studioId" = p."studioId" AND service."name" = m.name;
