export type PageElementRole =
  | "button"
  | "checkbox"
  | "dialog"
  | "heading"
  | "image"
  | "link"
  | "list"
  | "listitem"
  | "main"
  | "option"
  | "radio"
  | "search"
  | "section"
  | "select"
  | "status"
  | "tab"
  | "textbox"
  | "unknown";

export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageElement = {
  ref: string;
  role: PageElementRole;
  name: string;
  enabled: boolean;
  visible: boolean;
  bounds: ElementBounds;
};

export type PageObservation = {
  url: string;
  title: string;
  pageVersion: number;
  observedAt: string;
  elements: PageElement[];
};

export type BrowserAction =
  | {
    type: "click";
    ref: string;
    pageVersion: number;
  }
  | {
    type: "type";
    ref: string;
    text: string;
    pageVersion: number;
  }
  | {
    type: "press";
    key: string;
    ref?: string;
    pageVersion: number;
  }
  | {
    type: "scroll";
    deltaX?: number;
    deltaY: number;
    pageVersion: number;
  }
  | {
    type: "navigate";
    url: string;
  };

export type ActionStatus = "completed" | "failed";

export type ActionResult = {
  status: ActionStatus;
  pageVersion?: number;
  error?: {
    code: string;
    message: string;
  };
};

export type ExpectedOutcome =
  | {
    type: "urlChanged";
    fromUrl: string;
  }
  | {
    type: "elementAppears";
    ref?: string;
    role?: PageElementRole;
    name?: string;
  }
  | {
    type: "elementDisappears";
    ref?: string;
    role?: PageElementRole;
    name?: string;
  }
  | {
    type: "textAppears";
    text: string;
  }
  | {
    type: "stateChange";
    ref: string;
    previousName?: string;
  };

export type VerificationResult = {
  passed: boolean;
  checkedAt: string;
  outcome: ExpectedOutcome;
  message: string;
};
