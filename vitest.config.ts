import path from "node:path";
import { defineConfig } from "vitest/config";

// The demo files encode wall-clock times as UTC and the stats are computed in LOCAL time, so run the
// tests in UTC to make them independent of the machine's timezone. (Set before the worker processes start.)
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    env: { TZ: "UTC" },
  },
});
