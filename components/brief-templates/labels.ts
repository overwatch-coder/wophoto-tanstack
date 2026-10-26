import { BriefTemplateCategory } from "@/generated/prisma/browser";

export const BRIEF_TEMPLATE_CATEGORY_LABELS: Record<BriefTemplateCategory, string> = {
  [BriefTemplateCategory.COMMERCIAL]: "Commercial",
  [BriefTemplateCategory.EDITORIAL]: "Editorial",
  [BriefTemplateCategory.ECOMMERCE]: "E-Commerce",
  [BriefTemplateCategory.LOOKBOOK]: "Lookbook",
  [BriefTemplateCategory.PORTRAIT]: "Portrait",
  [BriefTemplateCategory.VIDEO_PRODUCTION]: "Video Production",
  [BriefTemplateCategory.SOCIAL_MEDIA]: "Social Media",
  [BriefTemplateCategory.OTHER]: "Other",
};

export function formatBriefTemplateCategory(category: BriefTemplateCategory | string): string {
  if (category in BRIEF_TEMPLATE_CATEGORY_LABELS) {
    return BRIEF_TEMPLATE_CATEGORY_LABELS[category as BriefTemplateCategory];
  }
  return category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getBriefTemplateCategoryBadgeClass(category: BriefTemplateCategory): string {
  switch (category) {
    case BriefTemplateCategory.COMMERCIAL:
      return "bg-primary/10 text-primary border-primary/20";
    case BriefTemplateCategory.EDITORIAL:
      return "bg-secondary text-secondary-foreground border-border";
    case BriefTemplateCategory.ECOMMERCE:
      return "bg-primary/10 text-primary border-primary/20";
    case BriefTemplateCategory.LOOKBOOK:
      return "bg-secondary text-secondary-foreground border-border";
    case BriefTemplateCategory.PORTRAIT:
      return "bg-muted text-foreground border-border";
    case BriefTemplateCategory.VIDEO_PRODUCTION:
      return "bg-primary/10 text-primary border-primary/20";
    case BriefTemplateCategory.SOCIAL_MEDIA:
      return "bg-secondary text-secondary-foreground border-border";
    case BriefTemplateCategory.OTHER:
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
