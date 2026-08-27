export { GitHubIntegration, createIssue, type CreateGitHubIssueInput, type CreateGitHubIssueOptions } from "./github.js";
export {
  GoogleCalendarIntegration,
  createOrUpdateEvent,
  type CalendarEventInput,
  type CreateOrUpdateCalendarEventInput,
  type MoveCalendarEventInput
} from "./google-calendar.js";
export { GmailIntegration, createDraft, type CreateGmailDraftInput } from "./gmail.js";
export {
  executePlannedMeetingAction,
  verifyPlannedMeetingAction,
  type MeetingActionExecutorConfig,
  type MeetingActionVerification
} from "./executor.js";
export { type AuthConfig, type IntegrationResult } from "./http.js";
