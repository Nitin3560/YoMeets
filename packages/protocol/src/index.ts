import type {
  ActionResult,
  BrowserAction,
  PageObservation
} from "@yomeets/browser-core";

export type ProtocolError = {
  code: string;
  message: string;
};

export type ObservePageRequest = {
  type: "OBSERVE_PAGE";
  requestId: string;
  tabId?: number;
};

export type ObservePageResult = {
  type: "OBSERVE_PAGE_RESULT";
  requestId: string;
  observation?: PageObservation;
  error?: ProtocolError;
};

export type ExecuteActionRequest = {
  type: "EXECUTE_ACTION";
  requestId: string;
  tabId?: number;
  action: BrowserAction;
};

export type ExecuteActionResult = {
  type: "ACTION_RESULT";
  requestId: string;
  result: ActionResult;
};

export type ExtensionRequest = ObservePageRequest | ExecuteActionRequest;

export type ExtensionResponse = ObservePageResult | ExecuteActionResult;
