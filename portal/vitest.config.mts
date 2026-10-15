import path from "node:path";

const __dirname = import.meta.dirname;
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(__dirname, "src"),
  // Next's guard module throws outside the react-server condition
  "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
};

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      // Needs a running backend (BACKEND_URL): `npx vitest run --project smoke`; never part of `npm test`
      { resolve: { alias }, test: { name: "smoke", include: ["tests/smoke/**/*.test.ts"], environment: "node", testTimeout: 60_000 } },
    ],
  },
});
