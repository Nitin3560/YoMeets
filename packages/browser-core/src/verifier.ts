import type {
  ExpectedOutcome,
  PageElement,
  PageObservation,
  VerificationResult
} from "./types.js";

function includesText(observation: PageObservation, text: string) {
  const needle = text.toLowerCase();

  return observation.elements.some((element) => element.name.toLowerCase().includes(needle));
}

function matchesElement(element: PageElement, outcome: Extract<ExpectedOutcome, { type: "elementAppears" | "elementDisappears" }>) {
  return (
    (!outcome.ref || element.ref === outcome.ref) &&
    (!outcome.role || element.role === outcome.role) &&
    (!outcome.name || element.name.toLowerCase().includes(outcome.name.toLowerCase()))
  );
}

function result(outcome: ExpectedOutcome, passed: boolean, message: string): VerificationResult {
  return {
    checkedAt: new Date().toISOString(),
    message,
    outcome,
    passed
  };
}

export function verifyOutcome(observation: PageObservation, outcome: ExpectedOutcome): VerificationResult {
  if (outcome.type === "urlChanged") {
    const passed = observation.url !== outcome.fromUrl;

    return result(outcome, passed, passed ? "URL changed" : "URL did not change");
  }

  if (outcome.type === "elementAppears") {
    const passed = observation.elements.some((element) => matchesElement(element, outcome) && element.visible);

    return result(outcome, passed, passed ? "Element appeared" : "Element did not appear");
  }

  if (outcome.type === "elementDisappears") {
    const passed = !observation.elements.some((element) => matchesElement(element, outcome) && element.visible);

    return result(outcome, passed, passed ? "Element disappeared" : "Element is still visible");
  }

  if (outcome.type === "textAppears") {
    const passed = includesText(observation, outcome.text);

    return result(outcome, passed, passed ? "Text appeared" : "Text did not appear");
  }

  const element = observation.elements.find((candidate) => candidate.ref === outcome.ref);
  const passed = Boolean(element && (!outcome.previousName || element.name !== outcome.previousName));

  return result(outcome, passed, passed ? "State changed" : "State did not change");
}
