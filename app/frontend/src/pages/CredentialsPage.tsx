import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeMedallion } from "@/components/credentials/BadgeMedallion";
import { outcomeLabel } from "@/evaluation/domain";
import { evaluationRepository } from "@/evaluation/repository";
import { CASE_DEFINITIONS, getCaseDefinition } from "@/evaluation/rubrics";
import type { Attempt, Credential, LearnerAccess } from "@/evaluation/types";

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

const PRIVATE_TOKEN_STORAGE_KEY = "simworks:private-access-token";

function privateTokenFromBrowser() {
  const fragment = window.location.hash.slice(1);
  if (fragment) {
    const token = decodeURIComponent(fragment);
    window.localStorage.setItem(PRIVATE_TOKEN_STORAGE_KEY, token);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
    return token;
  }
  return window.localStorage.getItem(PRIVATE_TOKEN_STORAGE_KEY) || "";
}

export function CredentialsPage() {
  const [privateToken, setPrivateToken] = useState(privateTokenFromBrowser);
  const [collection, setCollection] = useState<Collection | null | undefined>();
  const [selected, setSelected] = useState<Credential | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const next = await evaluationRepository.getLearnerCollection(privateToken);
      setCollection(next);
      if (selected && next) {
        setSelected(next.credentials.find((item) => item.id === selected.id) ?? null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Credentials failed to load.");
    }
  }

  useEffect(() => { void refresh(); }, [privateToken]);

  async function createPublicLink(credential: Credential) {
    try {
      const next = await evaluationRepository.createPublicLink(credential.id, privateToken);
      setSelected(next);
      await refresh();
      setNotice("Public verification link created.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sharing failed.");
    }
  }

  async function revokePublicLink(credential: Credential) {
    if (!window.confirm("Revoke this public link? Your private badge stays in this collection.")) return;
    try {
      const next = await evaluationRepository.revokePublicLink(credential.id, privateToken);
      setSelected(next);
      await refresh();
      setNotice("Public link revoked. You can create a replacement later.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Revocation failed.");
    }
  }

  async function rotatePrivateAccess() {
    if (
      !window.confirm(
        "Replace this private link? The current URL will stop working immediately.",
      )
    ) {
      return;
    }
    try {
      const access = await evaluationRepository.rotatePrivateAccess(privateToken);
      window.localStorage.setItem(
        PRIVATE_TOKEN_STORAGE_KEY,
        access.privateToken,
      );
      setPrivateToken(access.privateToken);
      setCollection(undefined);
      setSelected(null);
      setNotice("Private link replaced. The previous link is now invalid.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Private-link replacement failed.");
    }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setNotice(`${label} copied.`);
  }

  function startRetry(attempt: Attempt) {
    window.localStorage.removeItem(`simworks:${attempt.caseId}`);
    window.sessionStorage.removeItem(
      `simworks:submission-key:${attempt.caseId}`,
    );
    window.sessionStorage.setItem(
      `simworks:predecessor:${attempt.caseId}`,
      attempt.id,
    );
  }

  if (collection === undefined) return <main className="min-h-screen bg-[#eeede9] p-8 text-ink">Loading credentials…</main>;
  if (!collection) return <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink"><div className="max-w-lg rounded-panel bg-white p-8 text-center soft-edge"><h1 className="font-display text-3xl font-light">Private link unavailable</h1><p className="text-muted-deep">This bearer link is invalid or has been revoked. Request a replacement through SimWorks support.</p></div></main>;

  const earnedByCase = new Map(collection.credentials.map((item) => [item.caseId, item]));

  return (
    <main className="min-h-screen bg-[#eeede9] p-4 text-ink md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="m-0 text-micro font-semibold uppercase tracking-[.18em] text-muted">Private collection</p><h1 className="m-0 mt-2 font-display text-[44px] font-light">{collection.access.displayName}'s credentials</h1></div><div className="flex flex-wrap gap-2"><button onClick={rotatePrivateAccess} className="rounded-button bg-white px-4 py-2 text-small font-semibold soft-edge">Replace private link</button><Link className="rounded-button bg-white px-4 py-2 text-small font-semibold soft-edge" to="/">Explore cases</Link></div></header>
        <div className="mt-6 rounded-panel border border-amber-300 bg-amber-50 p-4 text-small text-amber-950">This prototype link is a bearer credential. Anyone you forward it to can see your private results. Keep it private.</div>
        {notice ? <p role="status" className="mt-4 rounded-panel bg-blue-50 p-4 text-small text-blue-950">{notice}</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-panel bg-red-50 p-4 text-small text-red-900">{error}</p> : null}

        <section className="mt-8"><h2 className="font-display text-3xl font-light">Badge collection</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CASE_DEFINITIONS.map((definition) => {
            const credential = earnedByCase.get(definition.id);
            return (
              <button key={definition.id} disabled={!credential} onClick={() => credential && setSelected(credential)} className="flex flex-col items-center rounded-panel bg-white p-6 text-center soft-edge disabled:cursor-default">
                <BadgeMedallion caseId={definition.id} locked={!credential} premium={Boolean(credential?.supplementalLabel)} />
                <span className="mt-5 text-label font-semibold">{definition.badge.name}</span>
                <span className="mt-1 text-micro text-muted">{credential ? `Earned ${new Date(credential.awardDate).toLocaleDateString()}` : definition.released ? "Locked · complete this case to earn" : "Coming after case approval"}</span>
              </button>
            );
          })}
        </div></section>

        <section className="mt-10"><h2 className="font-display text-3xl font-light">Attempt history</h2><div className="mt-4 grid gap-3">
          {collection.attempts.length ? [...collection.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((attempt) => (
            <article key={attempt.id} className="flex flex-wrap items-center justify-between gap-4 rounded-panel bg-white p-5 soft-edge">
              <div><h3 className="m-0 text-label">{attempt.caseTitle}</h3><p className="m-0 mt-1 text-micro text-muted">Attempt #{attempt.attemptNumber} · {new Date(attempt.submittedAt).toLocaleString()}</p></div>
              <div className="text-right"><p className="m-0 text-small font-semibold">{attemptStatusLabel(attempt)}</p>{attempt.review?.summary ? <p className="m-0 mt-1 max-w-xl text-small text-muted-deep">{attempt.review.summary}</p> : null}{attempt.review?.outcome === "remediation_required" ? <Link onClick={() => startRetry(attempt)} className="mt-2 inline-flex text-small font-semibold text-oxblood" to={`/simulations/${attempt.caseId}`}>Start a fresh linked attempt</Link> : null}</div>
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
          [
            "Suggested description",
            `${selected.caseTitle}: demonstrated case proficiency and responsible AI interaction through human-verified evaluation.`,
          ],
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
