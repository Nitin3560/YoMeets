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
