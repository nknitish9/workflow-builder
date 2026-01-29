import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_dcvzlrezrgwmamipmkam",
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  dirs: ["src/trigger"],
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
      }),
    ],
  },
});