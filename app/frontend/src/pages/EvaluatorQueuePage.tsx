import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { evaluationRepository } from "@/evaluation/repository";
import {
  clearEvaluatorSession,
  getEvaluatorSession,
  setEvaluatorSession,
} from "@/evaluation/session";
import {
  latestCompletedEvaluation,
  latestEvaluation,
  median,
  outcomeLabel,
} from "@/evaluation/domain";
import type { Attempt, AttemptStatus, SharedOutcome } from "@/evaluation/types";
import { getCaseDefinition } from "@/evaluation/rubrics";
import {
  filterQueueAttempts,
  readQueueFilters,
  writeQueueFilters,
} from "@/evaluation/queueFilters";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listSubmissions, triggerSubmissionEvaluation } from "@/lib/submissionStore";

const STATUS_LABELS: Record<AttemptStatus, string> = {
  pending_ai_processing: "Pending AI processing",
  ai_processing: "AI processing",
  ready_for_review: "Awaiting review",
  ai_failed: "AI evaluation failed",
  in_review: "In review",
  pass: "Pass",
  remediation_required: "Remediation required",
  not_yet_ready: "Not yet ready",
};

function isFinalAttempt(attempt: Attempt) {
  return (
    attempt.status === "pass" ||
    attempt.status === "remediation_required" ||
    attempt.status === "not_yet_ready"
  );
}

function AccessForm({ onReady }: { onReady: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const session = await evaluationRepository.authenticateEvaluator(code, name);
      setEvaluatorSession(session);
      onReady();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access failed.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
      <form onSubmit={submit} className="w-full max-w-md rounded-panel bg-white p-8 soft-edge">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Prototype evaluator access</p>
        <h1 className="mt-3 font-display text-[36px]">Evaluator console</h1>
        <p className="text-small text-muted-deep">Attribution is recorded but not identity-verified in this prototype.</p>
        <label className="mt-6 grid gap-2 text-small font-medium">Access code
          <input required type="password" value={code} onChange={(event) => setCode(event.target.value)} className="rounded-button border border-hairline px-4 py-3" />
        </label>
        <label className="mt-4 grid gap-2 text-small font-medium">Evaluator display name
          <input required value={name} onChange={(event) => setName(event.target.value)} className="rounded-button border border-hairline px-4 py-3" />
        </label>
        {error ? <p role="alert" className="text-small text-oxblood">{error}</p> : null}
        <button className="mt-6 w-full rounded-button bg-black px-5 py-3 text-small font-semibold text-white">Continue</button>
        <p className="mb-0 mt-4 text-center text-micro text-muted">Local demo code: SIMWORKS-DEMO</p>
      </form>
    </main>
  );
}

export function EvaluatorQueuePage() {
  const initialFilters = useMemo(readQueueFilters, []);
  const [session, setSession] = useState(getEvaluatorSession);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggering, setTriggering] = useState<Set<string>>(new Set());
  const [caseFilter, setCaseFilter] = useState(initialFilters.caseId);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [recommendationFilter, setRecommendationFilter] = useState(
    initialFilters.recommendation,
  );
  const [attemptFilter, setAttemptFilter] = useState(
    initialFilters.attemptNumber,
  );
  const [dateFilter, setDateFilter] = useState(
    initialFilters.submittedWithinDays,
  );

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    const load = isFirebaseConfigured ? listSubmissions() : evaluationRepository.listAttempts();
    load
      .then(setAttempts)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Queue failed to load."))
      .finally(() => setLoading(false));
  }, [session]);

  // Poll for status updates while any submission is in the triggering set.
  useEffect(() => {
    if (triggering.size === 0) return;
    const interval = setInterval(() => {
      const load = isFirebaseConfigured ? listSubmissions() : evaluationRepository.listAttempts();
      load.then((fresh) => {
        setAttempts(fresh);
        setTriggering((prev) => {
          const next = new Set(prev);
          for (const id of prev) {
            const updated = fresh.find((a) => a.id === id);
            if (!updated || updated.status !== "pending_ai_processing") next.delete(id);
          }
          return next;
        });
      }).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [triggering]);

  useEffect(() => {
    writeQueueFilters({
      caseId: caseFilter,
      status: statusFilter,
      recommendation: recommendationFilter,
      attemptNumber: attemptFilter,
      submittedWithinDays: dateFilter,
    });
  }, [
    attemptFilter,
    caseFilter,
    dateFilter,
    recommendationFilter,
    statusFilter,
  ]);

  const filtered = useMemo(
    () =>
      filterQueueAttempts(attempts, {
        caseId: caseFilter,
        status: statusFilter,
        recommendation: recommendationFilter,
        attemptNumber: attemptFilter,
        submittedWithinDays: dateFilter,
      }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [attemptFilter, attempts, caseFilter, dateFilter, recommendationFilter, statusFilter],
  );

  if (!session) return <AccessForm onReady={() => setSession(getEvaluatorSession())} />;

  const counts = (status: AttemptStatus) => attempts.filter((item) => item.status === status).length;
  const completed = attempts.filter((item) => ["pass", "remediation_required", "not_yet_ready"].includes(item.status));
  const agreements = completed.filter((item) => latestCompletedEvaluation(item)?.recommendation === item.review?.outcome).length;
  const reviewDurations = completed
    .map((item) =>
      item.review?.finalizedAt
        ? new Date(item.review.finalizedAt).getTime() -
          new Date(item.submittedAt).getTime()
        : 0,
    )
    .filter((value) => value > 0);
  const medianReviewHours = median(reviewDurations) / 3_600_000;
  const overrideCounts = completed.reduce(
    (counts, item) => {
      const aiById = new Map(
        (latestCompletedEvaluation(item)?.assessments ?? []).map((score) => [
          score.criterionId,
          score.points,
        ]),
      );
      for (const score of item.review?.scores ?? []) {
        counts.total += 1;
        if (aiById.get(score.criterionId) !== score.points) counts.overridden += 1;
      }
      return counts;
    },
    { overridden: 0, total: 0 },
  );

  return (
    <main className="min-h-screen bg-[#eeede9] p-4 text-ink md:p-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Human authority · all cases</p><h1 className="m-0 mt-2 font-display text-[42px]">Evaluation queue</h1></div>
          <div className="flex items-center gap-3 text-small"><span className="text-muted-deep">{session.evaluatorName} · unverified</span><button className="rounded-button bg-white px-4 py-2 soft-edge" onClick={() => { clearEvaluatorSession(); setSession(null); }}>Sign out</button></div>
        </header>

        <section aria-label="Queue summary" className="mt-7 grid gap-3 sm:grid-cols-3 xl:grid-cols-7">
          {([
            ["Pending AI", counts("pending_ai_processing")],
            ["Awaiting review", counts("ready_for_review")],
            ["In review", counts("in_review")],
            ["AI failed", counts("ai_failed")],
            ["Pass", counts("pass")],
            ["Remediation", counts("remediation_required")],
            ["Not yet ready", counts("not_yet_ready")],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-panel bg-white p-4 soft-edge"><p className="m-0 text-micro text-muted">{label}</p><p className="m-0 mt-2 font-display text-3xl">{value}</p></div>
          ))}
        </section>

        <section className="mt-5 rounded-panel bg-white p-4 soft-edge">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-micro text-muted">Case<select value={caseFilter} onChange={(event) => setCaseFilter(event.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink"><option value="all">All cases</option>{Array.from(new Map(attempts.map((item) => [item.caseId, item.caseTitle]))).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
            <label className="grid gap-1 text-micro text-muted">Review status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink"><option value="all">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="grid gap-1 text-micro text-muted">AI recommendation<select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink"><option value="all">All recommendations</option>{(["pass", "remediation_required", "not_yet_ready"] as SharedOutcome[]).map((value) => <option key={value} value={value}>{outcomeLabel(value)}</option>)}</select></label>
            <label className="grid gap-1 text-micro text-muted">Attempt number<select value={attemptFilter} onChange={(event) => setAttemptFilter(event.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink"><option value="all">All attempts</option>{Array.from(new Set(attempts.map((item) => item.attemptNumber))).sort().map((value) => <option key={value} value={value}>#{value}</option>)}</select></label>
            <label className="grid gap-1 text-micro text-muted">Submission date<select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink"><option value="all">Any date</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
          </div>
        </section>

        {loading ? <p className="mt-8 text-muted-deep">Loading attempts…</p> : null}
        {error ? <div role="alert" className="mt-6 rounded-panel border border-red-300 bg-red-50 p-4 text-small text-red-900">{error}</div> : null}
        {!loading && !error && filtered.length === 0 ? <div className="mt-6 rounded-panel bg-white p-8 text-center text-muted-deep soft-edge">No attempts match these filters.</div> : null}

        <section aria-label="Attempts" className="mt-5 grid gap-3">
          {filtered.map((attempt) => {
            const run = latestEvaluation(attempt);
            const rubric = getCaseDefinition(attempt.caseId).rubric;
            return (
              <Link key={attempt.id} to={`/eval/all-cases/${attempt.id}`} className="grid gap-4 rounded-panel bg-white p-5 text-inherit no-underline soft-edge transition-transform hover:-translate-y-0.5 lg:grid-cols-[1.2fr_1.3fr_.8fr_.9fr_.9fr] lg:items-center">
                <div><p className="m-0 font-semibold">{attempt.learnerDisplayName}</p><p className="m-0 mt-1 text-micro text-muted">{new Date(attempt.submittedAt).toLocaleString()} · Attempt #{attempt.attemptNumber}</p></div>
                <div><p className="m-0 text-small font-medium">{attempt.caseTitle}</p><p className="m-0 mt-1 text-micro text-muted">{attempt.category}</p></div>
                <div><p className="m-0 text-micro text-muted">AI evaluation</p><p className="m-0 mt-1 text-small font-medium">{run?.status ?? "Missing"}</p></div>
                <div><p className="m-0 text-micro text-muted">Case / AI interaction</p><p className="m-0 mt-1 text-small font-medium">{(() => { const ev = latestCompletedEvaluation(attempt); if (!ev) return "—"; const maxCase = rubric.criteria.filter((c) => c.dimension === "case_outcome").reduce((s, c) => s + c.maxPoints, 0); const maxInteraction = rubric.criteria.filter((c) => c.dimension === "ai_interaction").reduce((s, c) => s + c.maxPoints, 0); return `AI: ${ev.recommendation ? outcomeLabel(ev.recommendation) + " · " : ""}Total ${ev.caseScore + ev.interactionScore}/${maxCase + maxInteraction} (Case ${ev.caseScore}/${maxCase}, Interaction ${ev.interactionScore}/${maxInteraction})`; })()}</p></div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-micro font-semibold text-muted-deep">{STATUS_LABELS[attempt.status]}</span>
                    {attempt.claim ? <p className="m-0 mt-1 text-micro text-muted">Claimed by {attempt.claim.evaluatorName}</p> : null}
                  </div>
                  {isFirebaseConfigured && attempt.status === "pending_ai_processing" ? (
                    <button
                      className="shrink-0 rounded-button bg-black px-3 py-1.5 text-micro font-semibold text-white disabled:opacity-50"
                      disabled={triggering.has(attempt.id)}
                      onClick={(e) => {
                        e.preventDefault();
                        setTriggering((prev) => new Set(prev).add(attempt.id));
                        triggerSubmissionEvaluation(attempt.id).catch(console.error);
                      }}
                    >
                      {triggering.has(attempt.id) ? "Triggered…" : "Trigger AI Evaluation"}
                    </button>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-7 rounded-panel bg-[#1f1e1c] p-5 text-white">
          <h2 className="m-0 text-label">Evaluator-only reporting</h2>
          <div className="mt-4 grid gap-4 text-small sm:grid-cols-3 xl:grid-cols-6">
            <div><p className="m-0 text-white/60">Pending</p><p className="m-0 mt-1 text-xl">{attempts.length - completed.length}</p></div>
            <div><p className="m-0 text-white/60">Completed</p><p className="m-0 mt-1 text-xl">{completed.length}</p></div>
            <div><p className="m-0 text-white/60">AI/human agreement</p><p className="m-0 mt-1 text-xl">{completed.length ? Math.round((agreements / completed.length) * 100) : 0}%</p></div>
            <div><p className="m-0 text-white/60">Evaluation failures</p><p className="m-0 mt-1 text-xl">{attempts.length ? Math.round((attempts.filter((attempt) => attempt.evaluationRuns.some((run) => run.status === "failed" || run.status === "invalid")).length / attempts.length) * 100) : 0}%</p></div>
            <div><p className="m-0 text-white/60">Criterion override rate</p><p className="m-0 mt-1 text-xl">{overrideCounts.total ? Math.round((overrideCounts.overridden / overrideCounts.total) * 100) : 0}%</p></div>
            <div><p className="m-0 text-white/60">Median submit-to-final</p><p className="m-0 mt-1 text-xl">{medianReviewHours.toFixed(1)}h</p></div>
          </div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] border-collapse text-left text-small"><thead className="text-white/60"><tr><th className="border-b border-white/15 py-2">Case</th><th className="border-b border-white/15 py-2">Pending</th><th className="border-b border-white/15 py-2">Pass</th><th className="border-b border-white/15 py-2">Remediation</th><th className="border-b border-white/15 py-2">Not yet ready</th></tr></thead><tbody>{Array.from(new Map(attempts.map((item) => [item.caseId, item.caseTitle]))).map(([id, title]) => { const caseAttempts = attempts.filter((item) => item.caseId === id); return <tr key={id}><td className="border-b border-white/10 py-2 pr-4">{title}</td><td className="border-b border-white/10 py-2">{caseAttempts.filter((item) => !isFinalAttempt(item)).length}</td><td className="border-b border-white/10 py-2">{caseAttempts.filter((item) => item.status === "pass").length}</td><td className="border-b border-white/10 py-2">{caseAttempts.filter((item) => item.status === "remediation_required").length}</td><td className="border-b border-white/10 py-2">{caseAttempts.filter((item) => item.status === "not_yet_ready").length}</td></tr>; })}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}
