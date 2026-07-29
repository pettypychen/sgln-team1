import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  draftForAttempt,
  evaluationRepository,
} from "@/evaluation/repository";
import { getEvaluatorSession } from "@/evaluation/session";
import { isFirebaseConfigured } from "@/lib/firebase";
import { getEvaluationForSubmission } from "@/lib/submissionStore";
import {
  latestCompletedAssessments,
  latestEvaluation,
  outcomeLabel,
  scoreReview,
} from "@/evaluation/domain";
import { getCaseDefinition } from "@/evaluation/rubrics";
import { sourceArtifact } from "@/evaluation/sourceArtifacts";
import {
  filterQueueAttempts,
  readQueueFilters,
} from "@/evaluation/queueFilters";
import type {
  Attempt,
  EvidenceCitation,
  ReviewDraftInput,
  SharedOutcome,
} from "@/evaluation/types";

function CitationButton({
  citation,
  onSelect,
}: {
  citation: EvidenceCitation;
  onSelect: (citation: EvidenceCitation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(citation)}
      className={`rounded-button border px-3 py-2 text-left text-micro ${citation.resolved ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-red-300 bg-red-50 text-red-900"}`}
    >
      {citation.resolved ? "Verified evidence" : "Broken citation"} · {citation.source?.locator ?? "transcript"}
    </button>
  );
}

export function EvaluatorReviewPage() {
  const { attemptId = "" } = useParams();
  const navigate = useNavigate();
  const session = getEvaluatorSession();
  const evaluatorName = session?.evaluatorName;
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [draft, setDraft] = useState<ReviewDraftInput | null>(null);
  const [savedDraft, setSavedDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [claimConflict, setClaimConflict] = useState("");
  const [priorAttempt, setPriorAttempt] = useState<Attempt | null>(null);
  const [selectedSource, setSelectedSource] = useState<{
    id: string;
    label: string;
    locator: string;
    content: string;
  } | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const attemptRef = useRef<Attempt | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!session) {
      navigate("/eval/all-cases", { replace: true });
      return;
    }
    const loadAttempt = isFirebaseConfigured
      ? getEvaluationForSubmission(attemptId).then((loaded) => {
          if (!loaded) throw new Error("Evaluation not found for this submission.");
          return loaded;
        })
      : evaluationRepository.getAttempt(attemptId).then(async (loaded) => {
          if (!loaded) throw new Error("Attempt not found.");
          if (loaded.review?.status === "final") return loaded;
          try {
            return await evaluationRepository.claimReview(attemptId, session.evaluatorName);
          } catch (reason) {
            setClaimConflict(reason instanceof Error ? reason.message : "Review is read-only.");
            return loaded;
          }
        });
    loadAttempt
      .then((loaded) => {
        const nextDraft = draftForAttempt(loaded);
        setAttempt(loaded);
        setDraft(nextDraft);
        setSavedDraft(JSON.stringify(nextDraft));
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Review failed to load."));
  }, [attemptId, navigate, session?.evaluatorName]);

  useEffect(() => {
    if (!attempt?.predecessorAttemptId) {
      setPriorAttempt(null);
      return;
    }
    evaluationRepository
      .getAttempt(attempt.predecessorAttemptId)
      .then(setPriorAttempt)
      .catch(() => setPriorAttempt(null));
  }, [attempt?.predecessorAttemptId]);

  const dirty = draft ? JSON.stringify(draft) !== savedDraft : false;
  const readOnly =
    !attempt ||
    attempt.review?.status === "final" ||
    !session ||
    attempt.claim?.evaluatorName !== session.evaluatorName;
  attemptRef.current = attempt;
  dirtyRef.current = dirty;

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!evaluatorName || readOnly || isFirebaseConfigured) return;
    const interval = window.setInterval(() => {
      evaluationRepository
        .claimReview(attemptId, evaluatorName)
        .then((next) => setAttempt(next))
        .catch((reason: unknown) =>
          setClaimConflict(
            reason instanceof Error ? reason.message : "Review claim lost.",
          ),
        );
    }, 4 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [attemptId, evaluatorName, readOnly]);

  useEffect(
    () => () => {
      const current = attemptRef.current;
      if (
        !isFirebaseConfigured &&
        evaluatorName &&
        current?.claim?.evaluatorName === evaluatorName &&
        current.review?.status !== "final" &&
        !dirtyRef.current
      ) {
        void evaluationRepository.releaseClaim(current.id, evaluatorName);
      }
    },
    [evaluatorName],
  );

  const definition = attempt ? getCaseDefinition(attempt.caseId) : null;
  const assessments = useMemo(
    () => new Map((attempt ? latestCompletedAssessments(attempt) : []).map((item) => [item.criterionId, item])),
    [attempt],
  );
  const summary = attempt && draft ? scoreReview(attempt.caseId, draft.scores) : null;
  const caseTotalPoints = definition ? definition.rubric.criteria.filter((c) => c.dimension === "case_outcome").reduce((sum, c) => sum + c.maxPoints, 0) : 0;
  const interactionTotalPoints = definition ? definition.rubric.criteria.filter((c) => c.dimension === "ai_interaction").reduce((sum, c) => sum + c.maxPoints, 0) : 0;
  function selectEvidence(citation: EvidenceCitation) {
    const source = citation.source
      ? sourceArtifact(attempt?.caseId || "", citation.source.artifactId)
      : null;
    setNotice(
      citation.resolved && (!citation.source || source)
        ? `${citation.excerpt} — ${citation.connection}`
        : `Citation error: ${citation.source && !source ? "The source artifact is unavailable." : citation.connection}`,
    );
    if (citation.source && source) {
      setSelectedSource({
        id: source.id,
        label: source.label,
        locator: citation.source.locator,
        content: source.content,
      });
    }
    if (citation.messageId) {
      window.setTimeout(() => {
        const target = messageRefs.current[citation.messageId!];
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.focus({ preventScroll: true });
      }, 0);
    }
    if (citation.source && source) {
      window.setTimeout(() => {
        sourceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        sourceRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  }

  function updateScore(criterionId: string, field: "points" | "note" | "overrideReason", value: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      scores: draft.scores.map((score) =>
        score.criterionId === criterionId
          ? { ...score, [field]: field === "points" ? Number(value) : value }
          : score,
      ),
    });
  }

  async function takeover() {
    if (!session || !window.confirm("Take over this review and record the previous evaluator?")) return;
    try {
      const next = await evaluationRepository.claimReview(attemptId, session.evaluatorName, true);
      setAttempt(next);
      setClaimConflict("");
      setNotice("Review claim taken over and recorded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Takeover failed.");
    }
  }

  async function retryEvaluation() {
    try {
      const next = await evaluationRepository.retryEvaluation(attemptId);
      setAttempt(next);
      setNotice("AI retry queued; earlier evaluation runs were preserved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Retry failed.");
    }
  }

  async function save() {
    if (!session || !draft) return;
    setError("");
    try {
      const next = await evaluationRepository.saveReview(attemptId, session.evaluatorName, draft);
      setAttempt(next);
      setSavedDraft(JSON.stringify(draft));
      setNotice("Draft saved. No result, notification, or credential was released.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Draft save failed.");
    }
  }

  async function finalize() {
    if (!session || !draft || !summary) return;
    const confirmed = window.confirm(
      `Finalize ${outcomeLabel(draft.outcome)}? This releases the learner result and cannot be edited.`,
    );
    if (!confirmed) return;
    setError("");
    try {
      await evaluationRepository.finalizeReview(attemptId, session.evaluatorName, draft);
      setSavedDraft(JSON.stringify(draft));
      dirtyRef.current = false;
      const next = filterQueueAttempts(
        await evaluationRepository.listAttempts(),
        readQueueFilters(),
      ).find(
        (candidate) =>
          candidate.id !== attemptId &&
          candidate.status === "ready_for_review",
      );
      navigate(
        next ? `/eval/all-cases/${next.id}` : "/eval/all-cases",
        { replace: true },
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Finalization failed; retry is safe.");
    }
  }

  function confirmNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!dirty) return;
    if (!window.confirm("Discard unsaved review changes?")) {
      event.preventDefault();
      return;
    }
    dirtyRef.current = false;
  }

  if (error && !attempt) return <main className="min-h-screen bg-[#eeede9] p-8 text-ink"><div role="alert" className="mx-auto max-w-xl rounded-panel bg-red-50 p-5 text-red-900">{error}</div></main>;
  if (!attempt || !draft || !definition) return <main className="min-h-screen bg-[#eeede9] p-8 text-ink">Loading review…</main>;

  const run = latestEvaluation(attempt);
  const prior = attempt.predecessorAttemptId;

  return (
    <main className="min-h-screen bg-[#eeede9] text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link onClick={confirmNavigation} className="rounded-button bg-cloud px-4 py-2 text-small font-semibold text-ink" to="/eval/all-cases">Queue</Link>
            <div><p className="m-0 text-micro text-muted">{attempt.category} · Case {attempt.caseVersion} · Rubric {attempt.rubricVersion}</p><h1 className="m-0 text-label font-semibold">{attempt.learnerDisplayName} · Attempt #{attempt.attemptNumber}</h1></div>
          </div>
          <div className="text-right text-micro text-muted"><p className="m-0">{new Date(attempt.submittedAt).toLocaleString()}</p><p className="m-0 mt-1">{attempt.claim ? `Claimed by ${attempt.claim.evaluatorName} until ${new Date(attempt.claim.expiresAt).toLocaleTimeString()}` : "Read-only"}</p></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] gap-4 p-4 lg:grid-cols-[minmax(0,.9fr)_minmax(480px,1.1fr)] md:p-6">
        <section className="min-w-0 rounded-panel bg-white p-5 soft-edge">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">Evidence pane</p><h2 className="m-0 mt-2 text-card font-light">Immutable transcript</h2></div>{prior ? <Link onClick={confirmNavigation} className="text-small font-semibold text-muted-deep" to={`/eval/all-cases/${prior}`}>View prior attempt</Link> : null}</div>
          {notice ? <div role="status" className="mt-4 rounded-panel border border-blue-200 bg-blue-50 p-4 text-small text-blue-950">{notice}</div> : null}
          {priorAttempt ? <div className="mt-4 rounded-panel border border-violet-200 bg-violet-50 p-4 text-small text-violet-950"><p className="m-0 font-semibold">Prior attempt #{priorAttempt.attemptNumber} · {priorAttempt.review?.status === "final" ? outcomeLabel(priorAttempt.review.outcome) : "Not finalized"}</p><p className="mb-0 mt-1">{priorAttempt.review?.summary || "No finalized feedback available."}</p><Link onClick={confirmNavigation} className="mt-2 inline-flex font-semibold" to={`/eval/all-cases/${priorAttempt.id}`}>Quick-switch to prior attempt</Link></div> : null}
          <div className="mt-5 grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
            {attempt.transcript.length ? attempt.transcript.map((message) => (
              <div
                key={message.id}
                ref={(node) => { messageRefs.current[message.id] = node; }}
                tabIndex={-1}
                className={`rounded-panel p-4 outline-none focus:ring-2 focus:ring-blue-500 ${message.role === "learner" ? "ml-8 bg-[#f3eee4]" : "mr-8 bg-cloud"}`}
              >
                <p className="m-0 text-micro font-semibold uppercase text-muted">{message.role}</p>
                <p className="mb-0 mt-2 whitespace-pre-wrap text-small leading-relaxed">{message.content}</p>
              </div>
            )) : <div className="rounded-panel bg-amber-50 p-4 text-small text-amber-950">No transcript messages were captured. Manual scoring remains available.</div>}
          </div>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="m-0 text-micro font-semibold uppercase text-muted">Submitted work product</p>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-panel bg-[#f8f7f3] p-4 font-mono text-small">{attempt.workProduct || "No separate work product was submitted."}</pre>
          </div>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="m-0 text-micro font-semibold uppercase text-muted">Source artifacts</p>
            {attempt.sourceArtifacts.map((artifact) => {
              const available = sourceArtifact(attempt.caseId, artifact.id);
              return (
                <button
                  key={artifact.id}
                  disabled={!available}
                  onClick={() =>
                    available &&
                    setSelectedSource({
                      ...available,
                      locator: "Full submitted source",
                    })
                  }
                  className="mr-2 mt-2 rounded-button bg-cloud px-3 py-2 text-left text-small disabled:text-red-800"
                >
                  {artifact.id} · version {artifact.version}
                  {available ? "" : " · unavailable"}
                </button>
              );
            })}
          </div>
          {selectedSource ? (
            <div
              ref={sourceRef}
              tabIndex={-1}
              className="mt-5 rounded-panel border border-blue-200 bg-blue-50 p-4 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <p className="m-0 text-micro font-semibold uppercase text-blue-900">
                Opened source · {selectedSource.label}
              </p>
              <p className="mb-0 mt-2 text-small font-semibold text-blue-950">
                Locator: {selectedSource.locator}
              </p>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-button bg-white p-4 font-mono text-micro text-ink">
                {selectedSource.content}
              </pre>
            </div>
          ) : null}
        </section>

        <section className="min-w-0 rounded-panel bg-white p-5 soft-edge">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">Scoring pane</p><h2 className="m-0 mt-2 text-card font-light">Human decision with AI copilot</h2></div>
            <span className={`rounded-full px-3 py-1 text-micro font-semibold ${run?.status === "failed" ? "bg-red-100 text-red-900" : "bg-cloud"}`}>AI run: {run?.status ?? "missing"}</span>
          </div>
          <p className="mt-3 text-micro text-muted">Provider {run?.provider ?? "none"} · Model {run?.model ?? "none"} · Prompt {run?.promptVersion ?? "none"} · Run {run?.id ?? "none"}</p>

          {claimConflict ? <div role="alert" className="mt-4 rounded-panel border border-amber-300 bg-amber-50 p-4 text-small text-amber-950"><p className="m-0">{claimConflict}</p><button onClick={takeover} className="mt-3 rounded-button bg-black px-4 py-2 font-semibold text-white">Take over review</button></div> : null}
          {run?.status === "failed" ? <div className="mt-4 rounded-panel border border-red-300 bg-red-50 p-4 text-small text-red-900">AI evaluation failed. Manual review is available and finalization is not blocked.<button onClick={retryEvaluation} className="ml-3 rounded-button bg-white px-3 py-1.5 font-semibold soft-edge">Retry AI</button></div> : null}
          {error ? <div role="alert" className="mt-4 whitespace-pre-line rounded-panel border border-red-300 bg-red-50 p-4 text-small text-red-900">{error}</div> : null}

          <div className="mt-5 grid gap-4">
            {definition.rubric.criteria.map((criterion) => {
              const ai = assessments.get(criterion.id);
              const human = draft.scores.find((item) => item.criterionId === criterion.id)!;
              const overridden = ai && human.points !== ai.points;
              return (
                <div key={criterion.id} role="group" aria-label={`${criterion.label} · ${criterion.maxPoints} pts`} className="rounded-panel border border-hairline p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="m-0 text-small font-semibold">{criterion.label} · {criterion.maxPoints} pts</h3>
                    <span className="text-micro text-muted-deep">{criterion.dimension === "case_outcome" ? "Case outcome" : "AI interaction"}</span>
                  </div>
                  <p className="mt-1 text-small text-muted-deep">{criterion.description}</p>
                  <div className="mt-3 rounded-button bg-cloud p-3 text-small"><p className="m-0 font-semibold">AI: {ai ? `${ai.points}/${criterion.maxPoints}` : "No score"}</p><p className="mb-0 mt-1 text-muted-deep">{ai?.explanation ?? "Score manually from the rubric."}</p></div>
                  {ai?.evidence.length ? <div className="mt-3 flex flex-wrap gap-2">{ai.evidence.map((citation) => <CitationButton key={citation.id} citation={citation} onSelect={selectEvidence} />)}</div> : <p className="mt-3 text-micro text-red-800">No supporting evidence cited.</p>}
                  <label className="mt-4 grid gap-1 text-micro font-semibold text-muted">Human score
                    <input aria-label={`${criterion.label} human score`} disabled={readOnly} type="number" min={0} max={criterion.maxPoints} value={human.points} onChange={(event) => updateScore(criterion.id, "points", event.target.value)} className="w-28 rounded-button border border-hairline px-3 py-2 text-small text-ink" />
                  </label>
                  {overridden ? <label className="mt-3 grid gap-1 text-micro font-semibold text-muted">Required AI-score override reason<textarea aria-label={`${criterion.label} AI-score override reason`} disabled={readOnly} required value={human.overrideReason} onChange={(event) => updateScore(criterion.id, "overrideReason", event.target.value)} className="min-h-20 rounded-button border border-hairline px-3 py-2 text-small font-normal text-ink" /></label> : null}
                  <label className="mt-3 grid gap-1 text-micro font-semibold text-muted">Evaluator note<textarea aria-label={`${criterion.label} evaluator note`} disabled={readOnly} value={human.note} onChange={(event) => updateScore(criterion.id, "note", event.target.value)} className="min-h-16 rounded-button border border-hairline px-3 py-2 text-small font-normal text-ink" /></label>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-panel bg-[#201f1d] p-5 text-white shadow-xl">
            <div className="grid gap-3 sm:grid-cols-3"><div><p className="m-0 text-micro text-white/60">Case outcome · threshold {definition.rubric.caseThreshold}/{caseTotalPoints}</p><p className="m-0 mt-1 font-semibold">{summary?.caseScore}/{caseTotalPoints} · {summary?.casePassed ? "Meets threshold" : "Below threshold"}</p></div><div><p className="m-0 text-micro text-white/60">AI interaction · threshold {definition.rubric.interactionThreshold}/{interactionTotalPoints}</p><p className="m-0 mt-1 font-semibold">{summary?.interactionScore}/{interactionTotalPoints} · {summary?.interactionPassed ? "Meets threshold" : "Below threshold"}</p></div><div><p className="m-0 text-micro text-white/60">Calculated</p><p className="m-0 mt-1 font-semibold">{summary ? outcomeLabel(summary.outcome) : ""}</p></div></div>
            <label className="mt-4 grid gap-1 text-micro text-white/70">Final outcome<select disabled={readOnly} value={draft.outcome} onChange={(event) => { const outcome = event.target.value as SharedOutcome; setDraft({ ...draft, outcome, ...(outcome === "pass" ? {} : { supplementalLabel: "" }) }); }} className="rounded-button bg-white px-3 py-2 text-small text-ink">{(["pass", "remediation_required", "not_yet_ready"] as SharedOutcome[]).map((value) => <option key={value} value={value}>{outcomeLabel(value)}</option>)}</select></label>
            {summary && draft.outcome !== summary.outcome ? <label className="mt-3 grid gap-1 text-micro text-white/70">Required outcome override reason<textarea disabled={readOnly} value={draft.outcomeOverrideReason} onChange={(event) => setDraft({ ...draft, outcomeOverrideReason: event.target.value })} className="min-h-16 rounded-button bg-white px-3 py-2 text-small text-ink" /></label> : null}
            {draft.outcome === "pass" ? <label className="mt-3 grid gap-1 text-micro text-white/70">Supplemental case label (optional)<input disabled={readOnly} value={draft.supplementalLabel ?? ""} onChange={(event) => setDraft({ ...draft, supplementalLabel: event.target.value })} placeholder="For example, Distinction" className="rounded-button bg-white px-3 py-2 text-small text-ink" /></label> : null}
            <label className="mt-3 grid gap-1 text-micro text-white/70">Learner-facing evaluator summary<textarea disabled={readOnly} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="min-h-20 rounded-button bg-white px-3 py-2 text-small text-ink" /></label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={readOnly || !dirty} onClick={save} className="rounded-button bg-white px-4 py-2 text-small font-semibold text-ink disabled:opacity-40">Save draft</button>
              <button disabled={readOnly} onClick={finalize} className="rounded-button bg-[#c99a4b] px-4 py-2 text-small font-semibold text-black disabled:opacity-40">Finalize evaluation</button>
              <span aria-live="polite" className="self-center text-micro text-white/60">{dirty ? "Unsaved changes" : "Saved"}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
