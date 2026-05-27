// Sequential Reviewer — implement-then-review loop
//
// This template drives a two-phase workflow per issue:
//   Phase 1 (Implement): A sonnet agent picks an open issue, works on it
//                        on a dedicated branch, commits the changes, and signals
//                        completion.
//   Phase 2 (Review):    A second sonnet agent reviews the branch diff and either
//                        approves it or makes corrections directly on the branch.
//
// Both phases share a single sandbox created via createSandbox(), so the
// implementer and reviewer work on the same explicit branch.
//
// The outer loop repeats up to MAX_ITERATIONS times, processing one issue per
// iteration and stopping early once the backlog is exhausted (an implement
// phase that produces no commits). This is a middle-complexity option between
// the simple-loop (no review gate) and the parallel-planner (concurrent
// execution with a planning phase).
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of implement→review cycles to run before stopping.
// Keep this modest while the legacy baseline is being stabilized so each run is
// still practical to inspect before continuing.
const MAX_ITERATIONS = 3;

const IMPLEMENT_MODEL = "openai-codex/gpt-5.5:low";
const REVIEW_MODEL = "openai-codex/gpt-5.5:medium";

// Hooks run inside the sandbox before the agent starts each iteration.
// This repo uses pnpm on the host, so the sandbox should install from the same
// lockfile instead of generating npm metadata or copying pnpm's symlinked
// node_modules layout.
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: "corepack enable" },
      { command: "pnpm install --frozen-lockfile" },
    ],
  },
};

const copyToWorktree: string[] = [];

function readyForAgentIssueCount(): number {
  const output = execFileSync(
    "gh",
    [
      "issue",
      "list",
      "--state",
      "open",
      "--label",
      "ready-for-agent",
      "--limit",
      "100",
      "--json",
      "number",
      "--jq",
      "length",
    ],
    { encoding: "utf8" },
  );

  return Number.parseInt(output.trim(), 10);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // Generate a unique branch name for this iteration.
  const branch = `sandcastle/sequential-reviewer/${Date.now()}`;

  // Create a single sandbox that both the implementer and reviewer share.
  // This gives both agents a real, named branch that persists across phases.
  const sandbox = await sandcastle.createSandbox({
    branch,
    sandbox: docker({
      imageName: "sandcastle:web-lf2",
      mounts: [
        {
          hostPath: "~/.pi/agent",
          sandboxPath: "/home/agent/.pi/agent",
          readonly: false,
        },
      ],
    }),
    hooks,
    copyToWorktree,
  });

  try {
    // -----------------------------------------------------------------------
    // Phase 1: Implement
    //
    // A sonnet agent picks the next open issue, writes the
    // implementation (using RGR: Red → Green → Repeat → Refactor), and
    // commits the result.
    //
    // The agent signals completion via <promise>COMPLETE</promise> when done.
    // -----------------------------------------------------------------------
    // One iteration so each outer pass implements a single issue on its own
    // branch, then hands it to the reviewer. A higher value lets the agent
    // drain the whole backlog onto this one branch in a single pass, which
    // defeats the per-issue review.
    const implement = await sandbox.run({
      name: "implementer",
      maxIterations: 1,
      agent: sandcastle.pi(IMPLEMENT_MODEL),
      promptFile: "./.sandcastle/implement-prompt.md",
    });

    if (!implement.commits.length) {
      const remainingReadyIssues = readyForAgentIssueCount();

      if (remainingReadyIssues > 0) {
        throw new Error(
          `Implementation agent made no commits while ${remainingReadyIssues} ready-for-agent issue(s) remain. ` +
            "Treating this as an agent failure instead of silently stopping; inspect the implementer log above.",
        );
      }

      console.log("No ready-for-agent issues remain. Stopping.");
      break;
    }

    console.log(`\nImplementation complete on branch: ${branch}`);
    console.log(`Commits: ${implement.commits.length}`);

    // -----------------------------------------------------------------------
    // Phase 2: Review
    //
    // A second sonnet agent reviews the diff of the branch produced by
    // Phase 1. It uses the {{BRANCH}} prompt argument to inspect the right
    // branch, and either approves or makes corrections directly on the branch.
    // -----------------------------------------------------------------------
    await sandbox.run({
      name: "reviewer",
      maxIterations: 1,
      agent: sandcastle.pi(REVIEW_MODEL),
      promptFile: "./.sandcastle/review-prompt.md",
      promptArgs: {
        BRANCH: branch,
      },
    });

    console.log("\nReview complete.");
  } finally {
    await sandbox.close();
  }
}

console.log("\nAll done.");
