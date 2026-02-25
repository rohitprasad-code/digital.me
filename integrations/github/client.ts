import { Octokit } from "@octokit/rest";

export class GitHubClient {
  private octokit: Octokit;
  private username: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    const username = process.env.GITHUB_USERNAME;

    if (!token || !username) {
      throw new Error(
        "GITHUB_TOKEN and GITHUB_USERNAME must be set in environment variables",
      );
    }

    this.octokit = new Octokit({ auth: token });
    this.username = username;
  }

  async getProfile() {
    try {
      const { data } = await this.octokit.users.getByUsername({
        username: this.username,
      });
      return {
        login: data.login,
        name: data.name,
        bio: data.bio,
        public_repos: data.public_repos,
        followers: data.followers,
        following: data.following,
        html_url: data.html_url,
      };
    } catch (error) {
      console.error("Error fetching GitHub profile:", error);
      return null;
    }
  }

  async getRecentRepos(limit: number = 5) {
    try {
      const { data } = await this.octokit.repos.listForUser({
        username: this.username,
        sort: "updated",
        direction: "desc",
        per_page: limit,
      });

      return data.map((repo) => ({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        stars: repo.stargazers_count,
      }));
    } catch (error) {
      console.error("Error fetching recent repos:", error);
      return [];
    }
  }

  async getRecentActivity(limit: number = 10) {
    try {
      const { data } = await this.octokit.activity.listPublicEventsForUser({
        username: this.username,
        per_page: limit,
      });

      return data.map((event) => ({
        type: event.type,
        repo: event.repo.name,
        created_at: event.created_at,
        payload: event.payload, // Valid payload type check might be complex, keeping as is for flexibility
      }));
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      return [];
    }
  }
}
