import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { decideApproval, type ApprovalRequest } from "@yomeets/policy-engine";

export function parseApprovalAnswer(answer: string) {
  const normalized = answer.trim().toLowerCase();

  if (normalized === "y" || normalized === "yes") {
    return "yes";
  }

  if (normalized === "n" || normalized === "no") {
    return "no";
  }

  throw new Error("Approval answer must be y or n");
}

export async function promptForApproval(request: ApprovalRequest) {
  const readline = createInterface({
    input: stdin,
    output: stdout
  });

  try {
    const answer = await readline.question(`${request.prompt} (y/n) `);

    return decideApproval(request, parseApprovalAnswer(answer));
  } finally {
    readline.close();
  }
}
