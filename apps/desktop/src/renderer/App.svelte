<script lang="ts">
  const phases = [
    "Observe active browser state",
    "Choose deterministic action",
    "Execute and verify outcome",
    "Persist every checkpoint"
  ];
</script>

<main class="shell">
  <section class="workspace">
    <div class="status">
      <span>Phase 1</span>
      <strong>Desktop shell online</strong>
    </div>

    <div class="task">
      <label for="task">Task</label>
      <textarea id="task" placeholder="Find John Smith and open his profile"></textarea>
      <button type="button">Start</button>
    </div>

    <ol class="steps" aria-label="Agent loop">
      {#each phases as phase}
        <li>{phase}</li>
      {/each}
    </ol>
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    background: #f7f4ee;
    color: #242424;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }

  .shell {
    min-height: 100vh;
    padding: 32px;
  }

  .workspace {
    display: grid;
    gap: 24px;
    max-width: 920px;
  }

  .status {
    display: grid;
    gap: 6px;
  }

  .status span {
    color: #6f5f49;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .status strong {
    font-size: 36px;
    font-weight: 750;
  }

  .task {
    display: grid;
    gap: 12px;
    max-width: 680px;
  }

  label {
    font-size: 14px;
    font-weight: 700;
  }

  textarea {
    border: 1px solid #cfc7ba;
    border-radius: 8px;
    font: inherit;
    min-height: 120px;
    padding: 14px;
    resize: vertical;
  }

  button {
    background: #1f5c54;
    border: 0;
    border-radius: 8px;
    color: #ffffff;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    height: 44px;
    justify-self: start;
    padding: 0 18px;
  }

  .steps {
    display: grid;
    gap: 10px;
    margin: 0;
    max-width: 520px;
    padding-left: 22px;
  }

  .steps li {
    padding-left: 4px;
  }
</style>
