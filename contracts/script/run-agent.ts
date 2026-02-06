#!/usr/bin/env node
import "dotenv/config";
import { validateConfig } from "../../../agent/config.js";
import { resolveEnsName } from "../ens/resolve.js";
import { runAgentOnce } from "../../agent/index.js";

async function main() {
  try {
    validateConfig();

    await resolveEnsName();

    await runAgentOnce();

    console.log("[run-agent] Cycle completed.");
  } catch (error) {
    console.error("[run-agent] Fatal error", error);
    process.exitCode = 1;
  }
}

void main();
