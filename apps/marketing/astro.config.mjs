import { defineConfig } from "astro/config";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserPagesRepository = repository.toLowerCase().endsWith(".github.io");
const useGitHubPagesPreview = process.env.CATEGORYFIX_PREVIEW_DEPLOY === "github-pages";
const base = useGitHubPagesPreview && repository && !isUserPagesRepository ? `/${repository}/` : "/";
const site = useGitHubPagesPreview && process.env.GITHUB_REPOSITORY_OWNER
  ? `https://${process.env.GITHUB_REPOSITORY_OWNER}.github.io`
  : "https://categoryfix.com";

export default defineConfig({
  output: "static",
  site,
  base,
});
