import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const localApiUrl = "http://127.0.0.1:47821";

const terminal = createInterface({
  input: stdin,
  output: stdout
});

async function main() {
  stdout.write(`YoMeets local runner\nAPI: ${localApiUrl}\n\n`);

  const command = await terminal.question("Task> ");
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    stdout.write("No task entered.\n");
    return;
  }

  stdout.write(`Queued locally: ${trimmedCommand}\n`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`Failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    terminal.close();
  });
