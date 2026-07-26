import type { EvaluatorSession } from "./repository";

const KEY = "simworks:evaluator-session";

export function getEvaluatorSession(): EvaluatorSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Partial<EvaluatorSession>;
    if (
      typeof session.token !== "string" ||
      typeof session.evaluatorName !== "string" ||
      typeof session.expiresAt !== "string" ||
      !Number.isFinite(new Date(session.expiresAt).getTime()) ||
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return session as EvaluatorSession;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}

export function setEvaluatorSession(session: EvaluatorSession) {
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearEvaluatorSession() {
  window.sessionStorage.removeItem(KEY);
}
