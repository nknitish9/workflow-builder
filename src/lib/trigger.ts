import { task } from "@trigger.dev/sdk/v3";

if (!process.env.TRIGGER_SECRET_KEY) {
  throw new Error("Missing TRIGGER_SECRET_KEY");
}

export const trigger = task({
  id: "workflow-builder",
  run: async (payload) => {
    console.log("Trigger task running", payload);
  },
});