import {
  ArrowRight,
  BookOpen,
  Compass,
  LifeBuoy,
  MoonStar,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
} from "lucide-static";

export const marketingIconMap = {
  "arrow-right": ArrowRight,
  "book-open": BookOpen,
  compass: Compass,
  "life-buoy": LifeBuoy,
  "moon-star": MoonStar,
  "rotate-ccw": RotateCcw,
  "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal,
  sparkles: Sparkles,
  "sun-medium": SunMedium,
} as const;

export type MarketingIconName = keyof typeof marketingIconMap;
