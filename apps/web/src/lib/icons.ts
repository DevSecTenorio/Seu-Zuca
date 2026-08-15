import {
  Blocks,
  Boxes,
  Building2,
  Droplets,
  Hammer,
  Layers,
  Package,
  Paintbrush,
  PlugZap,
  Ruler,
  TreeDeciduous,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated Lucide icon set for categories. A fixed map (rather than lucide-react's dynamic
 * import-by-name helper) keeps category icons tree-shakeable and avoids trusting arbitrary
 * strings as import paths. Admin's category form only lets the user pick from CATEGORY_ICON_NAMES.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Layers,
  Building2,
  Paintbrush,
  PlugZap,
  Wrench,
  Droplets,
  Zap,
  TreeDeciduous,
  Blocks,
  Package,
  Hammer,
  Ruler,
  Truck,
  Boxes,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Package;
}
