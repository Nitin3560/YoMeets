type PageElementRole =
  | "button"
  | "checkbox"
  | "dialog"
  | "heading"
  | "link"
  | "main"
  | "radio"
  | "search"
  | "section"
  | "select"
  | "status"
  | "textbox"
  | "unknown";

type PageElement = {
  ref: string;
  role: PageElementRole;
  name: string;
  enabled: boolean;
  visible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type PageObservation = {
  url: string;
  title: string;
  pageVersion: number;
  observedAt: string;
  elements: PageElement[];
};

type ObserverGlobal = typeof globalThis & {
  __yomeetsObservePage?: () => PageObservation;
  __yomeetsPageVersion?: number;
  __yomeetsMutationObserver?: MutationObserver;
};

const selector = [
  "a",
  "button",
  "dialog",
  "h1",
  "h2",
  "h3",
  "input",
  "main",
  "p[role='status']",
  "section",
  "select",
  "textarea",
  "[role]"
].join(",");

const observerGlobal = globalThis as ObserverGlobal;

observerGlobal.__yomeetsPageVersion ??= 1;

if (!observerGlobal.__yomeetsMutationObserver) {
  observerGlobal.__yomeetsMutationObserver = new MutationObserver(() => {
    observerGlobal.__yomeetsPageVersion = (observerGlobal.__yomeetsPageVersion ?? 1) + 1;
  });

  observerGlobal.__yomeetsMutationObserver.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

function getRole(element: Element): PageElementRole {
  const explicitRole = element.getAttribute("role");

  if (explicitRole) {
    return explicitRole as PageElementRole;
  }

  const tagName = element.tagName.toLowerCase();

  if (tagName === "a") {
    return "link";
  }

  if (tagName === "button") {
    return "button";
  }

  if (tagName === "dialog") {
    return "dialog";
  }

  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }

  if (tagName === "input") {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();

    if (type === "checkbox") {
      return "checkbox";
    }

    if (type === "radio") {
      return "radio";
    }

    return "textbox";
  }

  if (tagName === "main") {
    return "main";
  }

  if (tagName === "section") {
    return "section";
  }

  if (tagName === "select") {
    return "select";
  }

  if (tagName === "textarea") {
    return "textbox";
  }

  return "unknown";
}

function getName(element: Element) {
  const ariaLabel = element.getAttribute("aria-label");

  if (ariaLabel) {
    return ariaLabel.trim();
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const label = element.labels?.[0]?.textContent?.trim();

    if (label) {
      return label;
    }

    return element.placeholder.trim();
  }

  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function isVisible(element: Element, bounds: DOMRect) {
  const style = window.getComputedStyle(element);

  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isEnabled(element: Element) {
  return !(element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement) || !element.disabled;
}

function observePage(): PageObservation {
  const elements: PageElement[] = [];

  for (const [index, element] of [...document.querySelectorAll(selector)].entries()) {
    const bounds = element.getBoundingClientRect();
    const name = getName(element);

    if (!name) {
      continue;
    }

    elements.push({
      bounds: {
        height: Math.round(bounds.height),
        width: Math.round(bounds.width),
        x: Math.round(bounds.x),
        y: Math.round(bounds.y)
      },
      enabled: isEnabled(element),
      name,
      ref: `e_${index + 1}`,
      role: getRole(element),
      visible: isVisible(element, bounds)
    });
  }

  return {
    elements,
    observedAt: new Date().toISOString(),
    pageVersion: observerGlobal.__yomeetsPageVersion ?? 1,
    title: document.title,
    url: window.location.href
  };
}

observerGlobal.__yomeetsObservePage = observePage;
