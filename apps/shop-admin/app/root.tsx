import type { LinksFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useEffect } from "react";
import adminStylesHref from "./styles/admin.css?url";

const themeStorageKey = "categoryfix-theme";
const themeInitScript = `
(() => {
  const storageKey = ${JSON.stringify(themeStorageKey)};
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const getStoredTheme = () => {
    try {
      const value = window.localStorage.getItem(storageKey);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  };
  const theme = getStoredTheme() ?? (media.matches ? "light" : "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
`;

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: adminStylesHref },
];

function ThemeController() {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const getStoredTheme = () => {
      try {
        const value = window.localStorage.getItem(themeStorageKey);
        return value === "light" || value === "dark" ? value : null;
      } catch {
        return null;
      }
    };

    const getResolvedTheme = () => getStoredTheme() ?? (media.matches ? "light" : "dark");

    const syncButtons = (theme = getResolvedTheme()) => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.setAttribute("aria-label", "Switch to " + nextTheme + " theme");
        button.setAttribute("title", "Switch to " + nextTheme + " theme");
        button.setAttribute("data-current-theme", theme);
        const label = button.querySelector("[data-theme-toggle-label]");
        if (label) {
          label.textContent = "Theme: " + theme.charAt(0).toUpperCase() + theme.slice(1);
        }
      });
    };

    const applyTheme = (theme: "light" | "dark") => {
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
      syncButtons(theme);
    };

    const persistTheme = (theme: "light" | "dark") => {
      try {
        window.localStorage.setItem(themeStorageKey, theme);
      } catch {}
    };

    const toggleTheme = () => {
      const nextTheme = getResolvedTheme() === "dark" ? "light" : "dark";
      persistTheme(nextTheme);
      applyTheme(nextTheme);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest("[data-theme-toggle]");
      if (!(button instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      toggleTheme();
    };

    const handleSystemThemeChange = () => {
      if (!getStoredTheme()) {
        applyTheme(getResolvedTheme());
      }
    };

    applyTheme(getResolvedTheme());
    document.addEventListener("click", handleDocumentClick);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleSystemThemeChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleSystemThemeChange);
    }

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleSystemThemeChange);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleSystemThemeChange);
      }
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com/" />
        <link rel="preconnect" href="https://fonts.gstatic.com/" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeController />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
