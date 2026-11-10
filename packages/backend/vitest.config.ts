import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The backend is plain Node: no DOM.
    environment: "node",
    // Tests live next to the code they test (foo.ts, foo.test.ts).
    include: ["src/**/*.test.ts"],
  },
});
