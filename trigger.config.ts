import { defineConfig } from "@trigger.dev/sdk/v3";

if (!process.env.TRIGGER_PROJECT_ID) {
  throw new Error("Missing TRIGGER_PROJECT_ID");
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID, 
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});