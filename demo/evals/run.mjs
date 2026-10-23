#!/usr/bin/env node
const scenario = process.argv[2] ?? "healthy";

if (scenario === "healthy") {
  console.log("EVAL PASS: baseline smoke test completed.");
  process.exit(0);
}

if (scenario === "migration-breaks-tool-use") {
  console.error("EVAL FAIL: the replacement fixture did not satisfy the required tool-use contract.");
  console.error("This is an intentionally failing synthetic scenario used to demonstrate the migration gate.");
  process.exit(1);
}

console.error(`Unknown demo scenario: ${scenario}`);
console.error("Available scenarios: healthy, migration-breaks-tool-use");
process.exit(2);
