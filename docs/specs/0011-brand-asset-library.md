# 0011. Brand Asset Library for Creative Media and Client Kits

**Date**: 2026-10-25
**Status**: In Progress

## Summary

This specification defines a centralized brand asset library for WoPhoto. It provides managers and creative workers with a single place to store, preview, download, and copy approved client brand assets and studio media kits. The system handles vector logos, structured color palettes with one click hex code copying, typography packages, brand guideline manuals, and external design references such as Figma files or Google Drive folders.

## Context

Commercial photography, video shoots, and digital design projects require immediate access to correct and approved brand assets. Photographers, editors, and graphic designers frequently need client vector logos for watermarking or composites, exact hex color codes for graphic lower thirds, font packages for campaign titles, and styling manuals to comply with client brand standards.

Without a shared brand library, workers waste time searching old email threads, requesting logos from managers, or pulling outdated low resolution artwork from web searches. Storing assets in disconnected cloud folders removes project context, breaks role based permissions, and makes hex color retrieval tedious.

WoPhoto needs an integrated brand asset management hub in the workspace shell. It must organize assets by client, project, or studio wide kits, provide instant color copying, and support both direct file storage and external tool links.

## Requirements

**User stories**:
- As a manager, I want to upload, categorize, and update client brand assets so our production team always uses approved creative materials.
- As a manager, I want to link external Figma files, cloud folders, or web styleguides so teams can jump directly to live design sources.
- As a worker, I want to search and filter brand assets by client, project, or asset type so I can find logos, guidelines, and assets quickly during editing.
- As a worker, I want to click any brand color swatch to copy its hex code directly to my clipboard so I can match brand colors in my creative tools without manual transcription.
- As a worker, I want to download original vector artwork, fonts, and PDF manuals so I have the high resolution files required for production.

**Acceptance criteria**:
- **AC-1**: Managers can create, update, and delete brand asset records with title, asset category, tags, optional description, client or project affiliation, and file or external link source.
- **AC-2**: Supported asset categories include Logo, Color Palette, Typography, Brand Guideline, Media Reference, and Template.
- **AC-3**: Color Palette assets store an array of structured color swatches with name and hex code, rendering interactive color swatches in the user interface with one click clipboard copy.
- **AC-4**: Assets support either direct file attachments with metadata (file name, size, mime type, download URL) or external design links (such as Figma or cloud folder links), with input validation enforcing at least one source.
- **AC-5**: The asset catalog provides filtering by client, project, asset type, and full text search across asset titles, descriptions, and tags.
- **AC-6**: Workers have read only access to the brand asset catalog, allowing them to preview media, download attached files, copy color codes, and open external reference links.
- **AC-7**: Assets can be scoped to a specific client, a specific project, or designated as general studio assets accessible across all projects.
- **AC-8**: Client accounts are strictly prohibited from accessing internal manager and worker brand asset workspace routes and actions.

## Options considered

### Option 1: Multi format hybrid library with structured color palettes

Support uploaded files, external tool URLs, and first class structured color swatches in a unified database entity.

**Pros**:
- Solves the primary daily creative need: instant color hex copying without downloading files.
- Accommodates modern workflows where design teams maintain live vector kits in Figma while storing PDF manuals locally.
- Clean category filtering and flexible client or project scoping.

**Cons**:
- Requires storing optional JSON palette data alongside file metadata.

### Option 2: Binary file storage only

Store all assets strictly as uploaded files in cloud blob storage without custom color swatch handling or external link options.

**Pros**:
- Simpler schema with standard file fields only.

**Cons**:
- Forces workers to download a PDF or image just to find a hex color code.
- Cannot reference live collaborative Figma workspaces or large video raw folders stored externally.

### Option 3: Third party embedded DAM widget

Embed a third party digital asset management widget into the workspace shell.

**Pros**:
- Offloads asset storage and preview rendering to a third party service.

**Cons**:
- Incurs external subscription costs and vendor lock in.
- Disconnects permissions from WoPhoto project assignments and dark/orange theme styling.

## Decision

**Chosen option**: Option 1: Multi format hybrid library with structured color palettes.

We will create a `BrandAsset` model in PostgreSQL via Prisma with support for file storage, external URLs, and structured color swatches, providing managers and workers with a fast and cohesive brand hub.

## Rationale

Creative multimedia work relies heavily on rapid color matching and vector access. Supporting structured swatches directly in the web interface saves hours of worker friction during photo retouching and video color grading. Allowing external Figma and cloud links acknowledges real world studio operations where extensive brand design files already live in specialized external tools.

## Feature design

**Data model sketch**:

```prisma
enum BrandAssetType {
  LOGO
  COLOR_PALETTE
  TYPOGRAPHY
  GUIDELINE
  MEDIA_REFERENCE
  TEMPLATE
}

model BrandAsset {
  id           String         @id @default(cuid())
  title        String
  description  String?        @db.Text
  assetType    BrandAssetType @default(LOGO)
  fileUrl      String?
  fileKey      String?
  fileName     String?
  fileSize     Int?
  fileMime     String?
  externalUrl  String?
  colorPalette Json?
  tags         String[]       @default([])
  clientId     String?
  client       User?          @relation("ClientBrandAssets", fields: [clientId], references: [id], onDelete: SetNull)
  projectId    String?
  project      Project?       @relation(fields: [projectId], references: [id], onDelete: SetNull)
  createdById  String
  createdBy    User           @relation("CreatedBrandAssets", fields: [createdById], references: [id], onDelete: Restrict)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([createdAt])
  @@index([clientId, createdAt])
  @@index([projectId, createdAt])
  @@index([assetType, createdAt])
  @@index([createdById])
}
```

User model relations added:
- `clientBrandAssets`: `BrandAsset[]` relation `"ClientBrandAssets"`
- `createdBrandAssets`: `BrandAsset[]` relation `"CreatedBrandAssets"`

Project model relation added:
- `brandAssets`: `BrandAsset[]`

**Color palette structure**:
```ts
type ColorSwatch = {
  name: string;
  hex: string;
  rgb?: string;
  pantone?: string;
};
```

**File upload and storage pipeline**:
- Storage backend: Vercel Blob private storage. Browser uploads use an authenticated token endpoint and are limited to 25 MB. Asset files are delivered by an authenticated route after role checks.
- Upload metadata: Store the Blob URL and server validated `brand-assets/` pathname with file name, size, and MIME type. Uploaded URL and pathname must match and belong to the private Blob host.
- File cleanup: Database updates/deletes complete before best effort cleanup of a replaced or removed managed blob; URLs outside the owned brand asset path are never deleted.
- File size limit: Maximum file size is 25 MB per upload.
- Allowed MIME types:
  - Vector and image artwork: `image/svg+xml`, `image/png`, `image/jpeg`, `image/webp`.
  - Documents and guides: `application/pdf`.
  - Typography: `font/otf`, `font/ttf`, `font/woff`, `font/woff2`.
  - Creative packages: `application/zip`, `image/vnd.adobe.photoshop`, `application/postscript`, `application/illustrator`.

**Scoping and data protection rules**:
- Studio wide assets: Assets with no client or project association represent internal studio brand kits.
- Project scoped assets: When an asset is attached to a project, `clientId` is automatically populated from `project.clientId`. If the project is ever deleted, the asset safely defaults to client scope rather than leaking to studio wide visibility.
- Worker visibility: Workers have studio wide read only visibility across all brand kits, allowing them to access client brand materials and studio templates for any creative assignment.

**Tag search conventions**:
- Tags are normalized to lowercase on creation and update.
- Search queries match on lowercase tag tokens, asset title, or description text.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getBrandAssets` | Server query | `clientId?`, `projectId?`, `assetType?`, `search?`, `page?`, `pageSize?` | `assets[]`, `pagination`, `stats` | Manager, Worker | 401, 403 |
| `getBrandAssetById` | Server query | `id` | `asset` | Manager, Worker | 401, 403, 404 |
| `updateBrandAsset` | Server action | `id`, updated fields | `asset` | Manager | 401, 403, 404, 422 |
| `deleteBrandAsset` | Server action | `id` | `success: boolean` | Manager | 401, 403, 404 |
| `/api/brand-assets/upload` | Vercel Blob client upload token route | Vercel `handleUpload` body; max 25 MB and allowed MIME types | Private Blob upload token and pathname | Manager | 403, 400 |
| `/api/brand-assets/[assetId]/file` | Authenticated file route | `assetId` | Private file stream | Manager, Worker | 404, 502 |
| `createBrandAsset` | Server action | `title`, `assetType`, `clientId?`, `projectId?`, `fileUrl?`, `fileKey?`, `fileName?`, `fileSize?`, `fileMime?`, `externalUrl?`, `colorPalette?`, `tags[]`, `description?` | `assetId` and action state | Manager | 401, 403, validation error |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Asset grid load | Brand asset records | `BrandAsset` table sorted by `createdAt desc` |
| Asset card preview | Image or thumbnail | Authenticated `/api/brand-assets/[assetId]/file` route or category placeholder icon |
| Color palette card | Interactive color swatches | `BrandAsset.colorPalette` JSON array |
| Download action | File content | Authenticated private stream from `/api/brand-assets/[assetId]/file`, backed by `BrandAsset.fileUrl` and checked against `BrandAsset.fileKey` |
| External link action | Tool redirect | `BrandAsset.externalUrl` validated as safe HTTP or HTTPS URL |
| Create asset | Creator identity | Current session user identifier from `requireRole` |
| Create asset | Client inheritance | Set to `project.clientId` when `projectId` is provided |
| File cleanup | Deleted blob | After successful database update/deletion, `del(fileUrl)` runs best effort only for validated `brand-assets/` objects not referenced by another asset |
| Asset modal load | Client and project options | Active clients from `prisma.user` and active projects from `prisma.project` |

**Key invariants**:
- Every brand asset must provide either a valid `fileUrl`, an `externalUrl`, or a non empty `colorPalette`.
- Non managers cannot create, modify, or delete brand assets.
- External URLs must be well formed web addresses starting with `http://` or `https://`.
- Color swatch hex codes must be valid hexadecimal color strings (such as `#FF6B00` or `#1A1A1A`).
- Project scoped assets inherit `clientId` to prevent accidental studio wide leakage if the project is deleted.
- Deleting an associated client or project preserves brand asset records by setting foreign keys to null.

**Security model**:
- `MANAGER`: Full CRUD access over all studio, client, and project brand assets.
- `WORKER`: Read only access, able to search, inspect, download attachments, and copy color swatches.
- `CLIENT`: No access to internal brand asset routes or actions.

**Critical test scenarios**:
- Happy path file asset: Manager uploads a vector logo with tags and client link, asset renders on library grid with download button, verifies **AC-1**, **AC-4**, **AC-5**.
- Color palette creation and copying: Manager creates a palette asset with three swatches, swatches render with hex codes, verifies **AC-2**, **AC-3**.
- External tool link: Manager saves a Figma workspace URL, card renders an external link button, verifies **AC-4**.
- Asset update and deletion lifecycle: Manager updates asset title and tags, then deletes the asset with blob cleanup verification, verifies **AC-1**.
- Scoping boundaries: Querying general studio assets, client filtered assets, and project specific assets returns isolated subsets, verifies **AC-7**.
- Validation: Attempting to create an asset without a file, external link, or color palette fails with a validation error, verifies **AC-4**.
- Hex code validation: Supplying an invalid hex string in a color palette fails input validation, verifies **AC-3**.
- Search filtering: Search query matches on normalized tag tokens, title substrings, and description text, verifies **AC-5**.
- Worker authorization: Worker can view assets and copy colors, but attempts to create, update, or delete fail with unauthorized status, verifies **AC-6**.
- Client boundary: Client session attempting to invoke brand asset queries or actions receives 403 Forbidden, verifies **AC-8**.

## Build plan

1. Add `BrandAssetType` enum and `BrandAsset` model to `prisma/schema.prisma` with indexes and relations, run migration, satisfies **AC-1**, **AC-2**.
2. Create validation schemas in `lib/validation/brand-assets.ts` with hex color validation, source requirement checks, and file constraints, satisfies **AC-1**, **AC-3**, **AC-4**.
3. Implement data access queries, authenticated private upload/download routes, and server actions in `lib/brand-assets.ts`, `app/api/brand-assets/`, and `app/actions/brand-assets.ts` with role checks, client inheritance, and blob cleanup, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-7**, **AC-8**.
4. Build the asset library components in `components/brand-assets/` including the asset grid, category filter tabs, color swatch cards with one click copying, and file download controls, satisfies **AC-2**, **AC-3**, **AC-5**, **AC-6**.
5. Build the asset creation and editing dialog in `components/brand-assets/brand-asset-dialog.tsx` supporting file uploads, external URLs, and dynamic swatch rows, satisfies **AC-1**, **AC-3**, **AC-4**, **AC-7**.
6. Wire page routes in `app/(workspace)/manager/brand-assets/page.tsx` and `app/(workspace)/worker/brand-assets/page.tsx`, removing placeholders from `[section]/page.tsx`, satisfies **AC-5**, **AC-6**, **AC-8**.
7. Write automated unit and integration tests in `test/brand-assets.test.ts` covering CRUD operations, validation rules, color palette handling, scoping, and role permissions, satisfies **AC-1** through **AC-8**.

## Consequences

**Positive**:
- Eliminates creative downtime by keeping approved logos, typography, and colors in one accessible location.
- Native color swatch copying speeds up retouching and layout workflows.
- Bridges local files and live external Figma or cloud workspaces seamlessly.
- Client inheritance protects brand asset confidentiality if projects are removed.

**Negative / tradeoffs**:
- Managers must curate and keep brand kits updated when clients rebrand.

**Neutral**:
- Adds one new database table and replaces the brand assets placeholder page for managers and workers.
