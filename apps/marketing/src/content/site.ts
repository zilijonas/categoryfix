import type { MarketingIconName } from "../lib/marketing-icons.js";

export type SiteLink = {
  label: string;
  pathname: string;
};

export type ActionLink = {
  label: string;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  ariaLabel?: string;
};

export type ProofMetric = {
  value: string;
  label: string;
  detail: string;
};

export type TrustPillar = {
  eyebrow: string;
  icon?: MarketingIconName;
  title: string;
  body: string;
};

export type WorkflowStep = {
  step: string;
  title: string;
  body: string;
};

export const siteConfig = {
  name: "CategoryFix",
  operatorName: "CategoryFix",
  supportEmail: "support@categoryfix.com",
  productionSiteUrl: "https://categoryfix.com",
  appUrl: "https://app.categoryfix.com",
  tagline: "Shopify category review, without blind automation.",
  trustStatement: "Category changes stay reviewable, explainable, and reversible.",
  summary:
    "Review Shopify product category recommendations with clear reasons, explicit preview, and rollback-ready changes.",
  navLinks: [
    { label: "Product", pathname: "/product" },
    { label: "How it works", pathname: "/how-it-works" },
    { label: "Docs", pathname: "/docs" },
    { label: "Support", pathname: "/support" },
    { label: "Closed beta", pathname: "/beta" },
  ] satisfies SiteLink[],
  footerLinks: [
    { label: "Privacy", pathname: "/privacy" },
    { label: "Terms", pathname: "/terms" },
    { label: "Support", pathname: "/support" },
  ] satisfies SiteLink[],
};

export function withBase(pathname: string): string {
  const baseUrl = import.meta.env.BASE_URL || "/";

  if (pathname === "/") {
    return baseUrl;
  }

  return `${baseUrl.replace(/\/$/, "")}${pathname}`;
}

export function createMailtoHref(subject: string): string {
  return `mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(subject)}`;
}

export const betaMailtoHref = createMailtoHref("CategoryFix beta request");
export const supportMailtoHref = createMailtoHref("CategoryFix support request");

export const primaryCtas = {
  requestBeta: {
    label: "Request Beta Access",
    href: betaMailtoHref,
    ariaLabel: "Request CategoryFix beta access by email",
  } satisfies ActionLink,
  viewWorkflow: {
    label: "See the Workflow",
    href: withBase("/how-it-works"),
    variant: "secondary",
  } satisfies ActionLink,
  viewDocs: {
    label: "Open Merchant Docs",
    href: withBase("/docs"),
    variant: "secondary",
  } satisfies ActionLink,
  contactSupport: {
    label: "Email Support",
    href: supportMailtoHref,
  } satisfies ActionLink,
  openApp: {
    label: "Open the Embedded App",
    href: siteConfig.appUrl,
    variant: "ghost",
  } satisfies ActionLink,
};

export const homeMetrics = [
  {
    value: "Preview-First",
    label: "Every write starts with a visible review step",
    detail: "Merchants inspect counts, basis facts, and change intent before apply jobs run.",
  },
  {
    value: "Deterministic Core",
    label: "Recommendations stay grounded in product data",
    detail: "Title, product type, tags, collections, vendor, and current category state drive the review surface.",
  },
  {
    value: "Rollback-Ready",
    label: "Undo remains part of the product flow",
    detail: "Applied changes keep before-and-after evidence so reversal is not hidden behind support.",
  },
] satisfies ProofMetric[];

export const trustPillars = [
  {
    eyebrow: "Explainability",
    icon: "shield-check",
    title: "Every recommendation stays tied to the product facts behind it.",
    body: "CategoryFix keeps the reason for each suggestion visible so teams can review evidence instead of taking a black-box score on faith.",
  },
  {
    eyebrow: "Merchant Control",
    icon: "sliders-horizontal",
    title: "Preview every category change before anything is written.",
    body: "No category write happens automatically. Approval remains explicit, visible, and merchant-controlled throughout the workflow.",
  },
  {
    eyebrow: "Operational Honesty",
    icon: "rotate-ccw",
    title: "Undo and rollback stay available after apply jobs complete.",
    body: "Rollback remains a first-party path so the product is honest about what changed and how to reverse it when needed.",
  },
] satisfies TrustPillar[];

export const workflowOverview = [
  {
    step: "01",
    title: "Scan",
    body: "Run a catalog scan to identify missing or likely-wrong Shopify product categories using current product signals.",
  },
  {
    step: "02",
    title: "Review",
    body: "Inspect recommendation basis, statuses, and preview counts before deciding what belongs in the change set.",
  },
  {
    step: "03",
    title: "Apply",
    body: "Write approved category updates only after an explicit merchant decision.",
  },
  {
    step: "04",
    title: "Rollback",
    body: "Reverse supported changes through the same product surface when a previous decision needs to be undone.",
  },
] satisfies WorkflowStep[];

export const trustGuardrails = [
  "AI-assisted suggestions stay optional and advisory.",
  "No numeric confidence percentages appear in the merchant-facing trust model.",
  "If CategoryFix cannot make a safe recommendation, it says so directly and leaves the product unchanged.",
];
