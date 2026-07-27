import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

Object.assign(globalThis, {
  window: {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  },
});

const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("useLayoutEffect does nothing on the server")
  ) {
    return;
  }
  originalError(...args);
};

const server = await createServer({
  configFile: "vite.config.ts",
  envDir: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { ModuleWorkspacePage } = await server.ssrLoadModule(
    "/src/pages/ModuleWorkspacePage.tsx",
  );
  const { PrototypeCasePage } = await server.ssrLoadModule(
    "/src/pages/PrototypeCasePage.tsx",
  );

  const legalMarkup = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/simulations/first-year-associate-ma-due-diligence"]}>
      <Routes>
        <Route
          path="/simulations/first-year-associate-ma-due-diligence"
          element={<ModuleWorkspacePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
  assert.match(legalMarkup, /Work the case/);
  assert.match(legalMarkup, /Your submission/);
  assert.match(legalMarkup, /Review and submit/);
  assert.doesNotMatch(legalMarkup, /Submit for AI grading/);

  const kopiMarkup = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/simulations/kopi-run"]}>
      <Routes>
        <Route path="/simulations/:caseId" element={<PrototypeCasePage />} />
      </Routes>
    </MemoryRouter>,
  );
  assert.match(kopiMarkup, /AI case agent/);
  assert.match(kopiMarkup, /Your answers/);
  assert.match(kopiMarkup, /Review and submit/);
  assert.doesNotMatch(kopiMarkup, /Submit for evaluation/);

  console.log("workspace standardization: all checks passed");
} finally {
  console.error = originalError;
  await server.close();
}
