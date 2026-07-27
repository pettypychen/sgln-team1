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

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.assign(globalThis, {
  window: { localStorage, sessionStorage },
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

localStorage.setItem(
  "simworks:kopi-run",
  JSON.stringify({
    chatMessages: [
      {
        id: "message-1",
        role: "user",
        content: "Please check Aiman against the menu.",
        status: "sent",
      },
    ],
    workProduct: "Aiman | K03 | Kopi O Kosong | SGD 1.40\nTotal | SGD 1.40",
  }),
);
sessionStorage.setItem("simworks:submission-key:kopi-run", "stable-key");

const server = await createServer({
  configFile: "vite.config.ts",
  envDir: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { ReadyForEvaluationPage } =
    await server.ssrLoadModule("/src/pages/ReadyForEvaluationPage.tsx");
  const { snapshotFromProgress } = await server.ssrLoadModule(
    "/src/evaluation/submissionSnapshot.ts",
  );

  const snapshot = snapshotFromProgress("kopi-run");
  assert.match(snapshot.workProduct, /Aiman/);

  localStorage.setItem("simworks:broken", "{malformed");
  assert.doesNotThrow(() => snapshotFromProgress("broken"));

  const markup = renderToStaticMarkup(
    <MemoryRouter initialEntries={["/simulations/kopi-run/ready"]}>
      <Routes>
        <Route
          path="/simulations/:caseId/ready"
          element={<ReadyForEvaluationPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

  assert.match(markup, /Your answers/);
  assert.match(markup, /submission-work-product/);
  assert.match(markup, /Aiman \| K03 \| Kopi O Kosong/);
  assert.match(markup, /Submit immutable attempt/);

  console.log("ready submission page: all checks passed");
} finally {
  console.error = originalError;
  await server.close();
}
