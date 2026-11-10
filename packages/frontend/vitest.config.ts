import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: that file carries the dev-server
// proxy and the React plugin, neither of which tests need.
export default defineConfig({
  test: {
    // Node is enough for logic like lib/http.ts (Node 26 ships fetch, Headers
    // and Response). jsdom and React Testing Library arrive with the first
    // component test.
    environment: "node",
    // Tests live next to the code they test (foo.ts, foo.test.ts).
    include: ["src/**/*.test.ts"],
    // By default Vitest replaces every imported CSS file with an empty string.
    // tokens.test.ts needs the real stylesheets (imported with ?raw), and the
    // module id then ends in "?raw", so a pattern anchored at ".css" would not
    // match: allow an optional query.
    css: { include: [/\.css(\?.*)?$/] },
  },
});
