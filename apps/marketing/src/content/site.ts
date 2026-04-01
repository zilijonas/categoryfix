export type SiteLink = {
  label: string;
  pathname: string;
};

export const siteConfig = {
  name: "CategoryFix",
  operatorName: "CategoryFix",
  supportEmail: "support@categoryfix.com",
  productionSiteUrl: "https://categoryfix.com",
  appUrl: "https://app.categoryfix.com",
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
