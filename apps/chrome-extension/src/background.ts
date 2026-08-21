type RuntimeMessage = {
  type: "PING_LOCAL_API";
};

type MessageResponse = {
  ok: boolean;
  status?: string;
  error?: string;
};

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

chrome.runtime.onInstalled.addListener(() => {
  void pingLocalApi();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "PING_LOCAL_API") {
    return false;
  }

  void pingLocalApi().then(sendResponse);
  return true;
});
