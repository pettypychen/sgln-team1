import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { evaluationRepository } from "@/evaluation/repository";
import { getCaseDefinition } from "@/evaluation/rubrics";
import { snapshotFromProgress } from "@/evaluation/submissionSnapshot";
import { CaseSubmissionPanel } from "@/components/simulation/CaseSubmissionPanel";
import { saveSubmission } from "@/lib/submissionStore";
import { getParticipantEmail, getParticipantName } from "@/participant/session";

function getParticipantId() {
  const key = "simworks:participant-id";
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

export function ReadyForEvaluationPage() {
  const { caseId: routeCaseId } = useParams();
  const caseId = routeCaseId ?? "first-year-associate-ma-due-diligence";
  const definition = getCaseDefinition(caseId);
  const initialSnapshot = useMemo(() => snapshotFromProgress(caseId), [caseId]);
  const [workProduct, setWorkProduct] = useState(initialSnapshot.workProduct);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    attemptNumber: number;
    submittedAt: string;
    privateToken: string;
    status: "pending_ai_processing" | "ai_failed" | "ai_processing" | "ready_for_review";
  } | null>(null);
  const idempotencyKey = useMemo(() => {
    const key = `simworks:submission-key:${caseId}`;
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
    const value = crypto.randomUUID();
    window.sessionStorage.setItem(key, value);
    return value;
  }, [caseId]);

  const displayName = getParticipantName() ?? "";
  const email = getParticipantEmail() ?? "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!confirmed) {
      setError("Confirm the immutable submission terms before submitting.");
      return;
    }
    if (!workProduct.trim()) {
      setError("Add your answer before submitting the immutable attempt.");
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
        workProduct,
        idempotencyKey,
        predecessorAttemptId:
          window.sessionStorage.getItem(`simworks:predecessor:${caseId}`) ||
          undefined,
      });
      void saveSubmission({
        displayName,
        email,
        caseId,
        caseTitle: definition.title,
        workProduct,
        evaluationStatus: "pending_ai_processing",
        attemptId: result.attempt.id,
        attemptNumber: result.attempt.attemptNumber,
      }).catch(console.error);
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
          result.attempt.status === "pending_ai_processing"
            ? "pending_ai_processing"
            : result.attempt.status === "ai_failed"
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
            <div><dt className="text-muted">Status</dt><dd className="m-0 mt-1 font-medium">{receipt.status === "pending_ai_processing" ? "Pending AI processing" : receipt.status === "ai_failed" ? "AI evaluation failed · manual review available" : receipt.status === "ai_processing" ? "AI evaluation started" : "Awaiting human review"}</dd></div>
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
          <div className="rounded-panel bg-cloud p-5 text-small text-muted-deep">
            <p className="m-0 font-semibold text-ink">Versioned evaluation</p>
            <p className="mb-0">Case {definition.version} · Rubric {definition.rubric.rubricVersion} · Human final authority</p>
          </div>
          <CaseSubmissionPanel
            title={caseId === "kopi-run" ? "Your answers" : "Your submission"}
            eyebrow="Review before submitting"
            description="This is the work product evaluators will see."
            value={workProduct}
            onChange={setWorkProduct}
            textareaId="submission-work-product"
            placeholder={caseId === "kopi-run" ? "Aiman | K03 | Kopi O Kosong | SGD 1.40\nBeatrice | ...\nCheryl | ...\nTotal | SGD ..." : "Paste or review the final work product you want evaluated."}
            editorClassName="min-h-64"
          />
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
