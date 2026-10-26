import { BrandAssetType } from "@/generated/prisma/browser";

export const BRAND_ASSET_TYPE_LABELS: Record<BrandAssetType, string> = {
  [BrandAssetType.LOGO]: "Logo & Vector",
  [BrandAssetType.COLOR_PALETTE]: "Color Palette",
  [BrandAssetType.TYPOGRAPHY]: "Typography & Font",
  [BrandAssetType.GUIDELINE]: "Brand Guideline",
  [BrandAssetType.MEDIA_REFERENCE]: "Media Reference",
  [BrandAssetType.TEMPLATE]: "Design Template",
};

export function formatBrandAssetType(type: BrandAssetType | string): string {
  if (type in BRAND_ASSET_TYPE_LABELS) {
    return BRAND_ASSET_TYPE_LABELS[type as BrandAssetType];
  }
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
