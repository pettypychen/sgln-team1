import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { evaluationRepository } from "@/evaluation/repository";
import { getCaseDefinition } from "@/evaluation/rubrics";
import type { ChatMessage } from "@/types";
import type { TranscriptMessage } from "@/evaluation/types";

interface StoredProgress {
  chatMessages?: ChatMessage[];
  messages?: TranscriptMessage[];
  workProduct?: string | Record<string, string>;
}

function getParticipantId() {
  const key = "simworks:participant-id";
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

function snapshotFromProgress(caseId: string) {
  const raw = window.localStorage.getItem(`simworks:${caseId}`);
  const progress = raw ? (JSON.parse(raw) as StoredProgress) : {};
  const transcript = progress.messages ?? (progress.chatMessages ?? []).map((message, index) => ({
    id: message.id,
    role: message.role === "user" ? "learner" : "agent",
    content: message.content,
    status: message.status === "failed" ? "failed" : "sent",
    createdAt: new Date(Date.now() - ((progress.chatMessages?.length ?? 0) - index) * 1000).toISOString(),
  }));
  const workProduct =
    typeof progress.workProduct === "string"
      ? progress.workProduct
      : Object.entries(progress.workProduct ?? {})
          .map(([label, content]) => `## ${label}\n\n${content}`)
          .join("\n\n");
  return { transcript, workProduct };
}

export function ReadyForEvaluationPage() {
  const { caseId: routeCaseId } = useParams();
  const caseId = routeCaseId ?? "first-year-associate-ma-due-diligence";
  const definition = getCaseDefinition(caseId);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    attemptNumber: number;
    submittedAt: string;
    privateToken: string;
    status: "ai_failed" | "ai_processing" | "ready_for_review";
  } | null>(null);
  const idempotencyKey = useMemo(() => {
    const key = `simworks:submission-key:${caseId}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
    const value = crypto.randomUUID();
    window.sessionStorage.setItem(key, value);
    return value;
  }, [caseId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!confirmed) {
      setError("Confirm the immutable submission terms before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const snapshot = snapshotFromProgress(caseId);
      const result = await evaluationRepository.submitAttempt({
        displayName,
        email,
        participantId: getParticipantId(),
        caseId,
        transcript: snapshot.transcript,
        workProduct: snapshot.workProduct,
        idempotencyKey,
        predecessorAttemptId:
          window.sessionStorage.getItem(`simworks:predecessor:${caseId}`) ||
          undefined,
      });
      window.localStorage.setItem(
        "simworks:private-access-token",
        result.access.privateToken,
      );
      setReceipt({
        id: result.attempt.id,
        attemptNumber: result.attempt.attemptNumber,
        submittedAt: result.attempt.submittedAt,
        privateToken: result.access.privateToken,
        status:
          result.attempt.status === "ai_failed"
            ? "ai_failed"
            : result.attempt.status === "ai_processing"
              ? "ai_processing"
              : "ready_for_review",
      });
      window.sessionStorage.removeItem(`simworks:predecessor:${caseId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <main className="min-h-screen bg-[#eeede9] p-6 text-ink">
        <section className="mx-auto mt-12 max-w-2xl rounded-panel bg-white p-8 soft-edge">
          <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Submission received</p>
          <h1 className="mt-3 font-display text-[38px] font-light">Your attempt is immutable.</h1>
          <dl className="mt-8 grid gap-4 rounded-panel bg-cloud p-5 text-small sm:grid-cols-2">
            <div><dt className="text-muted">Case</dt><dd className="m-0 mt-1 font-medium">{definition.title}</dd></div>
            <div><dt className="text-muted">Attempt</dt><dd className="m-0 mt-1 font-medium">#{receipt.attemptNumber}</dd></div>
            <div><dt className="text-muted">Submitted</dt><dd className="m-0 mt-1 font-medium">{new Date(receipt.submittedAt).toLocaleString()}</dd></div>
            <div><dt className="text-muted">Status</dt><dd className="m-0 mt-1 font-medium">{receipt.status === "ai_failed" ? "AI evaluation failed · manual review available" : receipt.status === "ai_processing" ? "AI evaluation started" : "Awaiting human review"}</dd></div>
          </dl>
          <p className="mt-5 text-small text-muted-deep">The provisional AI score stays private until a human finalizes the evaluation. A receipt notification has been queued.</p>
          <Link className="mt-5 inline-flex rounded-button bg-black px-5 py-3 text-small font-semibold text-white" to={`/credentials#${encodeURIComponent(receipt.privateToken)}`}>
            Open private results
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#eeede9] p-6 text-ink">
      <section className="mx-auto mt-8 max-w-2xl rounded-panel bg-white p-8 soft-edge">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Human-verified evaluation</p>
        <h1 className="mt-3 font-display text-[38px] font-light">Submit for evaluation</h1>
        <p className="mt-3 text-body text-muted-deep">This creates a permanent snapshot of your conversation and case materials. Your result is released only after human review.</p>
        <div className="mt-6 rounded-panel border border-amber-300 bg-amber-50 p-4 text-small text-amber-950">
          Do not submit confidential, client, or sensitive personal information.
        </div>
        <form className="mt-7 grid gap-5" onSubmit={submit}>
          <label className="grid gap-2 text-small font-medium">Display name
            <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-button border border-hairline px-4 py-3 font-normal" />
          </label>
          <label className="grid gap-2 text-small font-medium">Email
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-button border border-hairline px-4 py-3 font-normal" />
          </label>
          <div className="rounded-panel bg-cloud p-5 text-small text-muted-deep">
            <p className="m-0 font-semibold text-ink">Versioned evaluation</p>
            <p className="mb-0">Case {definition.version} · Rubric {definition.rubric.rubricVersion} · Human final authority</p>
          </div>
          <label className="flex items-start gap-3 text-small text-muted-deep">
            <input className="mt-1 h-4 w-4" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I understand this conversation becomes immutable and a human must finalize the result.</span>
          </label>
          {error ? <p role="alert" className="m-0 whitespace-pre-line text-small text-oxblood">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button disabled={submitting} className="rounded-button bg-black px-5 py-3 text-small font-semibold text-white disabled:opacity-50" type="submit">
              {submitting ? "Submitting…" : "Submit immutable attempt"}
            </button>
            <Link className="rounded-button bg-cloud px-5 py-3 text-small font-semibold text-muted-deep" to={`/simulations/${caseId}`}>Return to workspace</Link>
          </div>
        </form>
      </section>
    </main>
  );
}
