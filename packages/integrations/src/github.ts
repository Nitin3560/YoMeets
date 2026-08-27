import { getJson, postJson, requireEnv, type AuthConfig, type IntegrationResult } from "./http.js";

export type CreateGitHubIssueInput = {
  owner: string;
  repo: string;
  title: string;
  body: string;
  assignee?: string;
};

export type CreateGitHubIssueOptions = Omit<CreateGitHubIssueInput, "owner" | "repo"> & {
  owner?: string;
  repo?: string;
};

type GitHubIssueResponse = {
  assignees?: Array<{
    login?: string;
  }>;
  body?: string;
  html_url?: string;
  id?: number;
  number?: number;
  title?: string;
};

function issueUrl(input: Pick<CreateGitHubIssueInput, "owner" | "repo">, issueNumber?: string) {
  const base = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues`;

  return issueNumber ? `${base}/${encodeURIComponent(issueNumber)}` : base;
}

export class GitHubIntegration {
  constructor(private readonly auth: AuthConfig = { token: requireEnv("GITHUB_TOKEN") }) {}

  private headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.auth.token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  async createIssue(input: CreateGitHubIssueInput): Promise<IntegrationResult> {
    const body = {
      assignees: input.assignee ? [input.assignee] : undefined,
      body: input.body,
      title: input.title
    };
    const issue = await postJson<GitHubIssueResponse>(issueUrl(input), this.headers(), body);

    return {
      externalId: String(issue.number ?? issue.id ?? ""),
      provider: "github",
      raw: issue,
      url: issue.html_url
    };
  }

  async getIssue(input: Pick<CreateGitHubIssueInput, "owner" | "repo"> & { issueNumber: string }) {
    return getJson<GitHubIssueResponse>(issueUrl(input, input.issueNumber), this.headers());
  }
}

export async function createIssue(input: CreateGitHubIssueOptions, auth?: AuthConfig) {
  return new GitHubIntegration(auth).createIssue({
    assignee: input.assignee,
    body: input.body,
    owner: input.owner ?? requireEnv("GITHUB_OWNER"),
    repo: input.repo ?? requireEnv("GITHUB_REPO"),
    title: input.title
  });
}
