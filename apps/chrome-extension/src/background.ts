import type {
  ExecuteActionRequest,
  ExecuteActionResult,
  ExtensionRequest,
  ExtensionResponse,
  ObservePageResult
} from "@yomeets/protocol";

type RuntimeMessage = {
  type: "PING_LOCAL_API";
} | ExtensionRequest;

type MessageResponse = ({
  ok: boolean;
  status?: string;
  error?: string;
}) | ExtensionResponse;

declare const chrome: {
  runtime: {
    onInstalled: {
      addListener(listener: () => void): void;
    };
    onMessage: {
      addListener(
        listener: (
          message: RuntimeMessage,
          sender: unknown,
          sendResponse: (response: MessageResponse) => void
        ) => boolean | void
      ): void;
    };
  };
  scripting: {
    executeScript(
      details:
        | {
          target: { tabId: number };
          files: string[];
        }
        | {
          target: { tabId: number };
          func: () => unknown;
        }
        | {
          target: { tabId: number };
          func: (arg: unknown) => unknown;
          args: unknown[];
        }
    ): Promise<Array<{ result?: unknown }>>;
  };
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number }>>;
  };
};

const localApiUrl = "http://127.0.0.1:47821";

async function pingLocalApi(): Promise<MessageResponse> {
  try {
    const response = await fetch(`${localApiUrl}/health`);
    const body = await response.json() as { status?: string };

    return {
      ok: response.ok,
      status: body.status
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      error: message,
      ok: false
    };
  }
}

function observeErrorResult(requestId: string, code: string, message: string): ObservePageResult {
  return {
    error: {
      code,
      message
    },
    requestId,
    type: "OBSERVE_PAGE_RESULT"
  };
}

function actionErrorResult(requestId: string, code: string, message: string): ExecuteActionResult {
  return {
    requestId,
    result: {
      error: {
        code,
        message
      },
      status: "failed"
    },
    type: "ACTION_RESULT"
  };
}

async function getTargetTabId(tabId?: number) {
  if (typeof tabId === "number") {
    return tabId;
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return activeTab?.id;
}

async function observeTab(message: Extract<RuntimeMessage, { type: "OBSERVE_PAGE" }>): Promise<ObservePageResult> {
  const tabId = await getTargetTabId(message.tabId);

  if (typeof tabId !== "number") {
    return observeErrorResult(message.requestId, "NO_ACTIVE_TAB", "No active tab is available");
  }

  try {
    await chrome.scripting.executeScript({
      files: ["observer.js"],
      target: { tabId }
    });

    const [result] = await chrome.scripting.executeScript({
      func: () => {
        const observerGlobal = globalThis as typeof globalThis & {
          __yomeetsObservePage?: () => unknown;
        };

        return observerGlobal.__yomeetsObservePage?.();
      },
      target: { tabId }
    });

    return {
      observation: result?.result as ObservePageResult["observation"],
      requestId: message.requestId,
      type: "OBSERVE_PAGE_RESULT"
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return observeErrorResult(message.requestId, "OBSERVE_FAILED", errorMessage);
  }
}

async function executeAction(message: ExecuteActionRequest): Promise<ExecuteActionResult> {
  const tabId = await getTargetTabId(message.tabId);

  if (typeof tabId !== "number") {
    return actionErrorResult(message.requestId, "NO_ACTIVE_TAB", "No active tab is available");
  }

  try {
    await chrome.scripting.executeScript({
      files: ["observer.js", "executor.js"],
      target: { tabId }
    });

    const [actionResult] = await chrome.scripting.executeScript({
      args: [message.action],
      func: (action) => {
        const executorGlobal = globalThis as typeof globalThis & {
          __yomeetsExecuteAction?: (action: unknown) => unknown;
        };
        const executor = executorGlobal.__yomeetsExecuteAction;

        return executor?.(action);
      },
      target: { tabId }
    });

    return {
      requestId: message.requestId,
      result: actionResult?.result as ExecuteActionResult["result"],
      type: "ACTION_RESULT"
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return actionErrorResult(message.requestId, "ACTION_FAILED", errorMessage);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void pingLocalApi();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING_LOCAL_API") {
    void pingLocalApi().then(sendResponse);
    return true;
  }

  if (message.type === "OBSERVE_PAGE") {
    void observeTab(message).then(sendResponse);
    return true;
  }

  if (message.type === "EXECUTE_ACTION") {
    void executeAction(message).then(sendResponse);
    return true;
  }

  return false;
});
