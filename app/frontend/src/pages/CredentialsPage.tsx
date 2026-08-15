import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeMedallion } from "@/components/credentials/BadgeMedallion";
import { latestCompletedEvaluation, outcomeLabel } from "@/evaluation/domain";
import { credentialsApi, getLearnerCollectionByEmail } from "@/evaluation/repository";
import { CASE_DEFINITIONS, getCaseDefinition } from "@/evaluation/rubrics";
import { loadAttemptsByEmail } from "@/lib/submissionStore";
import { getParticipantEmail } from "@/participant/session";
import type { Attempt, Credential, LearnerAccess } from "@/evaluation/types";

function aiEvalLine(attempt: Attempt): string | null {
  const ev = latestCompletedEvaluation(attempt);
  if (!ev?.recommendation) return null;
  let maxCase = 0;
  let maxInteraction = 0;
  try {
    for (const c of getCaseDefinition(attempt.caseId).rubric.criteria) {
      if (c.dimension === "case_outcome") maxCase += c.maxPoints;
      else maxInteraction += c.maxPoints;
    }
  } catch {
    // unknown case — skip max display
  }
  const scoreStr = maxCase > 0
    ? ` · Case ${ev.caseScore}/${maxCase} · Interaction ${ev.interactionScore}/${maxInteraction}`
    : ` · Case ${ev.caseScore} · Interaction ${ev.interactionScore}`;
  return `AI: ${outcomeLabel(ev.recommendation)}${scoreStr}`;
}

function attemptStatusLabel(attempt: Attempt): string {
  if (attempt.review?.status === "final") return outcomeLabel(attempt.review.outcome);
  const runs = attempt.evaluationRuns ?? [];
  const latestRun = runs[runs.length - 1];
  if (!latestRun) {
    return attempt.status === "ai_processing"
      ? "AI evaluation in progress"
      : "AI evaluation failed · manual review available";
  }
  if (latestRun.status === "processing") return "AI evaluation in progress";
  if (latestRun.status === "completed") return "Awaiting human review";
  return "AI evaluation failed · manual review available";
}

interface Collection {
  access: LearnerAccess;
  attempts: Attempt[];
  credentials: Credential[];
}

const EMAIL_STORAGE_KEY = "simworks:credentials-email";

export function CredentialsPage() {
  const [email, setEmail] = useState(() => {
    const fragment = window.location.hash.slice(1);
    if (fragment) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      return decodeURIComponent(fragment);
    }
    return window.localStorage.getItem(EMAIL_STORAGE_KEY) || getParticipantEmail() || "";
  });
  const [emailInput, setEmailInput] = useState(email);
  const [collection, setCollection] = useState<Collection | null | undefined>();
  const [selected, setSelected] = useState<Credential | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const accessRef = useRef<LearnerAccess | null>(null);
  const refreshGenRef = useRef(0);

  async function refresh() {
    if (!email) return;
    const gen = ++refreshGenRef.current;
    try {
      const firestoreData = await loadAttemptsByEmail(email);
      if (gen !== refreshGenRef.current) return;
      if (!firestoreData) { setCollection(null); return; }
      setCollection((prev) => ({
        access: prev?.access ?? { participantId: "", displayName: firestoreData.displayName, email, privateToken: "" },
        attempts: firestoreData.attempts,
        credentials: prev?.credentials ?? [],
      }));
    } catch (reason) {
      if (gen === refreshGenRef.current)
        setError(reason instanceof Error ? reason.message : "Credentials failed to load.");
    }
  }

  async function loadCredentials(): Promise<Credential[]> {
    const full = await getLearnerCollectionByEmail(email);
    if (!full) return [];
    accessRef.current = full.access;
    setCollection((prev) => prev ? { ...prev, access: full.access, credentials: full.credentials } : null);
    return full.credentials;
  }

  async function openBadge(caseId: string) {
    const existing = collection?.credentials.find((c) => c.caseId === caseId);
    if (existing) { setSelected(existing); return; }
    try {
      const credentials = await loadCredentials();
      const cred = credentials.find((c) => c.caseId === caseId);
      if (cred) setSelected(cred);
    } catch {
      setError("Could not load credential details. Please try again shortly.");
    }
  }

  useEffect(() => {
    if (!email) { setCollection(undefined); return; }
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    void refresh();
  }, [email]);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    setCollection(undefined);
    setError("");
    setSelected(null);
    setEmail(trimmed);
  }

  async function getToken(): Promise<string | null> {
    if (accessRef.current?.privateToken) return accessRef.current.privateToken;
    try { await loadCredentials(); } catch { /* fall through */ }
    return accessRef.current?.privateToken || null;
  }

  async function createPublicLink(credential: Credential) {
    const token = await getToken();
    if (!token) { setError("Cannot create public link without a valid session."); return; }
    try {
      const next = await credentialsApi.createPublicLink(credential.id, token);
      setSelected(next);
      await loadCredentials();
      setNotice("Public verification link created.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sharing failed.");
    }
  }

  async function revokePublicLink(credential: Credential) {
    if (!window.confirm("Revoke this public link? Your private badge stays in this collection.")) return;
    const token = await getToken();
    if (!token) { setError("Cannot revoke public link without a valid session."); return; }
    try {
      const next = await credentialsApi.revokePublicLink(credential.id, token);
      setSelected(next);
      await loadCredentials();
      setNotice("Public link revoked. You can create a replacement later.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revocation failed.");
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copied.`);
  }

  function startRetry(attempt: Attempt) {
    window.localStorage.removeItem(`simworks:${attempt.caseId}`);
    window.sessionStorage.removeItem(`simworks:submission-key:${attempt.caseId}`);
    window.sessionStorage.setItem(`simworks:predecessor:${attempt.caseId}`, attempt.id);
  }

  if (!email) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
        <div className="w-full max-w-md rounded-panel bg-white p-8 soft-edge">
          <h1 className="m-0 font-display text-3xl font-light">View your credentials</h1>
          <p className="mt-3 text-small text-muted-deep">Enter the email address you used when submitting cases.</p>
          <form onSubmit={handleEmailSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-button border border-hairline px-4 py-3 text-small outline-none focus:ring-2 focus:ring-black"
            />
            <button type="submit" className="rounded-button bg-black px-4 py-3 text-small font-semibold text-white">
              View credentials
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (collection === undefined) return <main className="min-h-screen bg-[#eeede9] p-8 text-ink">Loading credentials…</main>;

  if (!collection) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
        <div className="max-w-lg rounded-panel bg-white p-8 text-center soft-edge">
          <h1 className="font-display text-3xl font-light">No records found</h1>
          <p className="text-muted-deep">No submissions were found for <strong>{email}</strong>.</p>
          <button onClick={() => { setEmail(""); setEmailInput(""); setCollection(undefined); }} className="mt-4 rounded-button bg-black px-4 py-2 text-small font-semibold text-white">
            Try a different email
          </button>
        </div>
      </main>
    );
  }

  const earnedByCase = new Map(collection.credentials.map((item) => [item.caseId, item]));
  // Infer which cases the learner has passed from attempt reviews, so badges show correctly
  // before credentials are loaded from the Cloud Function.
  const passedCases = new Map(
    collection.attempts
      .filter((a) => a.review?.status === "final" && a.review?.outcome === "pass")
      .map((a) => [a.caseId, a.review?.finalizedAt ?? a.submittedAt]),
  );

  return (
    <main className="min-h-screen bg-[#eeede9] p-4 text-ink md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-micro font-semibold uppercase tracking-[.18em] text-muted">Credential collection</p>
            <h1 className="m-0 mt-2 font-display text-[44px] font-light">{collection.access.displayName}'s credentials</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setEmail(""); setEmailInput(""); setCollection(undefined); }} className="rounded-button bg-white px-4 py-2 text-small font-semibold soft-edge">Switch account</button>
            <Link className="rounded-button bg-white px-4 py-2 text-small font-semibold soft-edge" to="/">Explore cases</Link>
          </div>
        </header>

        {notice ? <p role="status" className="mt-4 rounded-panel bg-blue-50 p-4 text-small text-blue-950">{notice}</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-panel bg-red-50 p-4 text-small text-red-900">{error}</p> : null}

        <section className="mt-8"><h2 className="font-display text-3xl font-light">Badge collection</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CASE_DEFINITIONS.map((definition) => {
            const credential = earnedByCase.get(definition.id);
            const earnedAt = credential?.awardDate ?? passedCases.get(definition.id);
            const isEarned = Boolean(credential ?? passedCases.has(definition.id));
            return (
              <button key={definition.id} disabled={!isEarned} onClick={() => void openBadge(definition.id)} className="flex flex-col items-center rounded-panel bg-white p-6 text-center soft-edge disabled:cursor-default">
                <BadgeMedallion caseId={definition.id} locked={!isEarned} premium={Boolean(credential?.supplementalLabel)} />
                <span className="mt-5 text-label font-semibold">{definition.badge.name}</span>
                <span className="mt-1 text-micro text-muted">{isEarned ? `Earned${earnedAt ? ` ${new Date(earnedAt).toLocaleDateString()}` : ""}` : definition.released ? "Locked · complete this case to earn" : "Coming after case approval"}</span>
              </button>
            );
          })}
        </div></section>

        <section className="mt-10">
          <h2 className="font-display text-3xl font-light">Attempt history</h2>
          <div className="mt-4 grid gap-3">
          {collection.attempts.length ? [...collection.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((attempt) => (
            <article key={attempt.id} className="flex flex-wrap items-center justify-between gap-4 rounded-panel bg-white p-5 soft-edge">
              <div><h3 className="m-0 text-label">{attempt.caseTitle}</h3><p className="m-0 mt-1 text-micro text-muted">Attempt #{attempt.attemptNumber} · {new Date(attempt.submittedAt).toLocaleString()}</p></div>
              <div className="text-right"><p className="m-0 text-small font-semibold">{attemptStatusLabel(attempt)}</p>{aiEvalLine(attempt) ? <p className="m-0 mt-1 text-micro text-muted">{aiEvalLine(attempt)}</p> : null}{attempt.review?.summary ? <p className="m-0 mt-1 max-w-xl text-small text-muted-deep">{attempt.review.summary}</p> : null}{attempt.review?.outcome === "remediation_required" ? <Link onClick={() => startRetry(attempt)} className="mt-2 inline-flex text-small font-semibold text-oxblood" to={`/simulations/${attempt.caseId}`}>Start a fresh linked attempt</Link> : null}</div>
            </article>
          )) : <div className="rounded-panel bg-white p-6 text-muted-deep soft-edge">No submitted attempts yet.</div>}
        </div></section>
      </div>

      {selected ? (() => {
        const definition = getCaseDefinition(selected.caseId);
        const publicUrl = selected.publicToken ? `${window.location.origin}/verify/${selected.publicToken}` : "";
        const fields = [
          ["Credential name", definition.badge.name],
          ["Issuer", selected.issuer],
          ["Issue date", new Date(selected.awardDate).toLocaleDateString()],
          ["Credential ID", selected.id],
          ["Credential URL", publicUrl],
          ["Suggested description", `${selected.caseTitle}: demonstrated case proficiency and responsible AI interaction through human-verified evaluation.`],
        ];
        return (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4">
            <button aria-label="Close credential detail" className="absolute inset-0 h-full w-full cursor-default" onClick={() => setSelected(null)} />
            <section role="dialog" aria-modal="true" aria-labelledby="credential-title" className="relative my-8 w-full max-w-3xl rounded-panel bg-white p-7 shadow-2xl">
              <button aria-label="Close credential detail" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-cloud text-xl" onClick={() => setSelected(null)}>×</button>
              <div className="grid gap-7 md:grid-cols-[220px_1fr]">
                <BadgeMedallion caseId={selected.caseId} size="lg" premium={Boolean(selected.supplementalLabel)} />
                <div><p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">{selected.category}{selected.supplementalLabel ? ` · ${selected.supplementalLabel}` : ""}</p><h2 id="credential-title" className="m-0 mt-2 font-display text-4xl font-light">{definition.badge.name}</h2><p className="mt-3 text-small text-muted-deep">{selected.caseTitle} · demonstrates case proficiency and responsible AI interaction.</p>
                  <dl className="mt-5 grid gap-3 text-small sm:grid-cols-2"><div><dt className="text-muted">Awarded to</dt><dd className="m-0 mt-1 font-semibold">{selected.learnerDisplayName}</dd></div><div><dt className="text-muted">Issue date</dt><dd className="m-0 mt-1 font-semibold">{new Date(selected.awardDate).toLocaleDateString()}</dd></div><div><dt className="text-muted">Credential ID</dt><dd className="m-0 mt-1 break-all font-mono text-micro">{selected.id}</dd></div><div><dt className="text-muted">Authority</dt><dd className="m-0 mt-1">{selected.evaluationAuthority}</dd></div></dl>
                </div>
              </div>
              <div className="mt-7 border-t border-hairline pt-5">
                <h3 className="m-0 text-label">Public verification</h3>
                {selected.status === "public" && publicUrl ? <div className="mt-3 rounded-panel bg-cloud p-4"><p className="m-0 break-all text-small">{publicUrl}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => copy("Public URL", publicUrl)} className="rounded-button bg-white px-3 py-2 text-small font-semibold soft-edge">Copy URL</button><Link target="_blank" className="rounded-button bg-white px-3 py-2 text-small font-semibold soft-edge" to={`/verify/${selected.publicToken}`}>Preview</Link><button onClick={() => revokePublicLink(selected)} className="rounded-button bg-red-50 px-3 py-2 text-small font-semibold text-red-900">Revoke</button></div></div> : <button onClick={() => createPublicLink(selected)} className="mt-3 rounded-button bg-black px-4 py-2 text-small font-semibold text-white">Create public link</button>}
              </div>
              <div className="mt-7 border-t border-hairline pt-5"><h3 className="m-0 text-label">Add to LinkedIn</h3><p className="text-small text-muted-deep">LinkedIn requires you to enter certification fields manually. Copy the fields below, then open Add to Profile.</p><div className="grid gap-2 sm:grid-cols-2">{fields.map(([label, value]) => <button key={label} disabled={!value} onClick={() => copy(label, value)} className="flex items-center justify-between rounded-button bg-cloud px-3 py-2 text-left text-small disabled:opacity-40"><span>{label}</span><span className="font-semibold">Copy</span></button>)}</div><a className="mt-4 inline-flex rounded-button bg-[#0a66c2] px-4 py-2 text-small font-semibold text-white" href="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" target="_blank" rel="noreferrer">Open LinkedIn Add to Profile</a></div>
            </section>
          </div>
        );
      })() : null}
    </main>
  );
}
