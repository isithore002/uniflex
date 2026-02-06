import { observe } from "./observe.js";
import { decide } from "./decide.js";
import { execute } from "./execute.js";

export async function runAgentOnce() {
  console.log("[agent] Starting deterministic loop");

  const observed = await observe();
  console.log("[agent] Observed state", observed);

  const decision = decide(observed);
  console.log("[agent] Decision", decision);

  const execution = await execute(decision);
  console.log("[agent] Execution result", execution);

  return execution;
}
