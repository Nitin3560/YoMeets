import { postJson, requireEnv, type AuthConfig, type IntegrationResult } from "./http.js";

export type CreateGitHubIssueInput = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  assignee?: string;
};

type GitHubIssueResponse = {
  html_url?: string;
  id?: number;
  number?: number;
};

function issueUrl(input: CreateGitHubIssueInput) {
  return `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`;
}

export class GitHubIntegration {
  constructor(private readonly auth: AuthConfig = { token: requireEnv("GITHUB_TOKEN") }) {}

  async createIssue(input: CreateGitHubIssueInput): Promise<IntegrationResult> {
    const body = {
      assignees: input.assignee ? [input.assignee] : undefined,
      body: input.body,
      title: input.title
    };
    const issue = await postJson<GitHubIssueResponse>(issueUrl(input), {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.auth.token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }, body);

    return {
      externalId: String(issue.number ?? issue.id ?? ""),
      provider: "github",
      raw: issue,
      url: issue.html_url
    };
  }
}
