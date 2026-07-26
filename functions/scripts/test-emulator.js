"use strict";

const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const FUNCTIONS_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(FUNCTIONS_DIR, "..");
const FIREBASE_BIN = path.join(FUNCTIONS_DIR, "node_modules", ".bin", "firebase");
const MOCK_PORT = 9876;
const NODE_BIN = path.dirname(process.execPath);

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function javaMajor(javaHome = "") {
  const executable = javaHome ? path.join(javaHome, "bin", "java") : "java";
  const result = spawnSync(executable, ["-version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const version = `${result.stderr || ""}${result.stdout || ""}`;
  const match = version.match(/version "(?:1\.)?(\d+)/);
  return result.status === 0 && match ? Number(match[1]) : 0;
}

function resolveJavaHome() {
  const candidates = [
    process.env.JAVA_HOME || "",
    ...(process.platform === "darwin"
      ? [
          commandOutput("/usr/libexec/java_home", ["-v", "21"]),
          commandOutput("brew", ["--prefix", "openjdk@21"]),
        ]
      : []),
  ];
  return candidates.find((candidate) => candidate && javaMajor(candidate) >= 21) || "";
}

const JAVA_HOME = resolveJavaHome();

function assertJava21() {
  if (javaMajor(JAVA_HOME) < 21) {
    throw new Error(
      "Firebase emulator tests require Java 21 or newer. Set JAVA_HOME to a supported JDK.",
    );
  }
}

const deliveries = [];
const evaluationAttempts = new Map();
const emailAttempts = new Map();

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const provider = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/evaluate") {
      const body = await readJson(req);
      const attemptId = body.attempt?.id;
      const attemptCount = (evaluationAttempts.get(attemptId) || 0) + 1;
      evaluationAttempts.set(attemptId, attemptCount);
      if (
        body.attempt?.participantId === "learner-evaluation-retry" &&
        attemptCount === 1
      ) {
        json(res, 503, { error: "Deterministic first-run failure." });
        return;
      }
      const artifactId = body.sourceArtifacts?.[0]?.id;
      const message = body.attempt?.transcript?.find(
        (item) => item.role === "learner",
      );
      const assessments = (body.rubric?.criteria || []).map((criterion) => ({
        criterionId: criterion.id,
        points: criterion.maxPoints,
        explanation: "Locally verified provider evidence supports this score.",
        supported: true,
        evidence: [
          {
            messageId: message?.id,
            source: {
              artifactId,
              locator: "row 1",
            },
            excerpt: message?.content,
            connection: "The cited source directly supports the criterion.",
          },
        ],
      }));
      json(res, 200, { assessments, criticalFailures: [] });
      return;
    }
    if (req.method === "POST" && req.url === "/email") {
      const body = await readJson(req);
      const emailCount = (emailAttempts.get(body.to) || 0) + 1;
      emailAttempts.set(body.to, emailCount);
      if (
        body.to === "learner-notification-retry@example.test" &&
        emailCount === 1
      ) {
        json(res, 503, { error: "Deterministic first-delivery failure." });
        return;
      }
      deliveries.push({
        idempotencyKey: req.headers["idempotency-key"],
        ...body,
      });
      json(res, 200, { accepted: true, id: `mock-${deliveries.length}` });
      return;
    }
    if (req.method === "GET" && req.url === "/deliveries") {
      json(res, 200, deliveries);
      return;
    }
    json(res, 404, { error: "Mock provider route not found." });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

assertJava21();

provider.listen(MOCK_PORT, "127.0.0.1", () => {
  const child = spawn(
    FIREBASE_BIN,
    [
      "emulators:exec",
      "--project",
      "demo-sgln-evaluation",
      "--only",
      "firestore,functions,pubsub",
      "node functions/scripts/test-emulator-client.js",
    ],
    {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: [
          NODE_BIN,
          ...(JAVA_HOME ? [path.join(JAVA_HOME, "bin")] : []),
          process.env.PATH,
        ]
          .filter(Boolean)
          .join(path.delimiter),
        ...(JAVA_HOME ? { JAVA_HOME } : {}),
        EVALUATOR_ACCESS_CODE: "local-evaluator-code",
        PRIVATE_TOKEN_SECRET: "local-private-token-secret-with-adequate-length",
        EVALUATION_API_KEY: "local-evaluation-api-key",
        EMAIL_DELIVERY_API_KEY: "local-email-api-key",
        EVALUATION_ENDPOINT: `http://127.0.0.1:${MOCK_PORT}/evaluate`,
        EMAIL_DELIVERY_ENDPOINT: `http://127.0.0.1:${MOCK_PORT}/email`,
        PUBLIC_APP_URL: "http://127.0.0.1:5000",
        EVALUATION_PROVIDER: "local-fixture",
        EVALUATION_MODEL: "deterministic-v1",
      },
    },
  );

  child.on("exit", (code, signal) => {
    provider.close(() => {
      if (signal) {
        process.stderr.write(`Firebase emulator exited from signal ${signal}.\n`);
        process.exitCode = 1;
      } else {
        process.exitCode = code ?? 1;
      }
    });
  });

  child.on("error", (error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    provider.close(() => {
      process.exitCode = 1;
    });
  });
});
