type BrowserAction =
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

type ActionResult = {
  status: "completed" | "failed";
  pageVersion?: number;
  error?: {
    code: string;
    message: string;
  };
};

type ExecutorGlobal = typeof globalThis & {
  __yomeetsActionRefs?: Map<string, Element>;
  __yomeetsExecuteAction?: (action: BrowserAction) => ActionResult;
  __yomeetsPageVersion?: number;
};

const executorGlobal = globalThis as ExecutorGlobal;

function fail(code: string, message: string): ActionResult {
  return {
    error: {
      code,
      message
    },
    pageVersion: executorGlobal.__yomeetsPageVersion ?? 1,
    status: "failed"
  };
}

function done(): ActionResult {
  return {
    pageVersion: executorGlobal.__yomeetsPageVersion ?? 1,
    status: "completed"
  };
}

function getElement(ref: string) {
  return executorGlobal.__yomeetsActionRefs?.get(ref);
}

function ensureCurrentPageVersion(pageVersion: number) {
  return pageVersion === (executorGlobal.__yomeetsPageVersion ?? 1);
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, text: string) {
  element.focus();
  element.value = text;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function executeAction(action: BrowserAction): ActionResult {
  if (action.type === "navigate") {
    window.location.href = action.url;
    return done();
  }

  if (!ensureCurrentPageVersion(action.pageVersion)) {
    return fail("STALE_ELEMENT_REFERENCE", "Page version changed before action execution");
  }

  if (action.type === "scroll") {
    window.scrollBy({
      behavior: "instant",
      left: action.deltaX ?? 0,
      top: action.deltaY
    });
    return done();
  }

  const element = action.ref ? getElement(action.ref) : undefined;

  if (!element) {
    return fail("ELEMENT_NOT_FOUND", `No element found for ${action.ref}`);
  }

  if (action.type === "click") {
    if (element instanceof HTMLElement) {
      element.click();
      return done();
    }

    return fail("UNSUPPORTED_ELEMENT", "Element cannot be clicked");
  }

  if (action.type === "type") {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setInputValue(element, action.text);
      return done();
    }

    return fail("UNSUPPORTED_ELEMENT", "Element cannot receive text");
  }

  if (action.type === "press") {
    const target = element instanceof HTMLElement ? element : document.body;

    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: action.key }));
    target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: action.key }));
    return done();
  }

  return fail("UNKNOWN_ACTION", "Unknown browser action");
}

executorGlobal.__yomeetsExecuteAction = executeAction;
