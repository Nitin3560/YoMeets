import type { PageObservation } from "@yomeets/browser-core";

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

export type ExtensionRequest = ObservePageRequest;

export type ExtensionResponse = ObservePageResult;
