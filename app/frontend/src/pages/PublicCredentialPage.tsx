import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeMedallion } from "@/components/credentials/BadgeMedallion";
import { evaluationRepository } from "@/evaluation/repository";
import { getCaseDefinition } from "@/evaluation/rubrics";
import type { PublicCredential } from "@/evaluation/types";

export function PublicCredentialPage() {
  const { publicToken = "" } = useParams();
  const [credential, setCredential] = useState<PublicCredential | null | undefined>();

  useEffect(() => {
    evaluationRepository.resolvePublicCredential(publicToken).then(setCredential);
  }, [publicToken]);

  useEffect(() => {
    if (!credential || credential.status !== "public") return;
    const definition = getCaseDefinition(credential.caseId);
    document.title = `${definition.badge.name} · SimWorks verified credential`;
    const description = `${credential.learnerDisplayName} earned the ${definition.badge.name} credential from SimWorks.`;
    let meta = document.querySelector('meta[property="og:description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [credential]);

  if (credential === undefined) return <main className="grid min-h-screen place-items-center bg-[#eeede9] text-ink">Verifying credential…</main>;
  if (!credential || credential.status !== "public") {
    return <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink"><section className="max-w-xl rounded-panel bg-white p-9 text-center soft-edge"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-stone-200 text-3xl">×</div><h1 className="mt-6 font-display text-4xl font-light">Share link no longer valid</h1><p className="text-muted-deep">This public verification URL was revoked or does not exist. No private credential information is available from this link.</p></section></main>;
  }

  const definition = getCaseDefinition(credential.caseId);
  return (
    <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
      <section className="w-full max-w-3xl rounded-panel bg-white p-8 text-center soft-edge md:p-12">
        <p className="m-0 text-micro font-semibold uppercase tracking-[.2em] text-muted">SimWorks · verified credential</p>
        <div className="mx-auto mt-8 w-fit"><BadgeMedallion caseId={credential.caseId} size="lg" premium={Boolean(credential.supplementalLabel)} /></div>
        <h1 className="m-0 mt-7 font-display text-[44px] font-light">{definition.badge.name}</h1>
        <p className="mt-3 text-body text-muted-deep">Awarded to <strong className="text-ink">{credential.learnerDisplayName}</strong> for {credential.caseTitle}{credential.supplementalLabel ? ` · ${credential.supplementalLabel}` : ""}.</p>
        <div className="mx-auto mt-7 grid max-w-xl gap-4 rounded-panel bg-cloud p-5 text-left text-small sm:grid-cols-2">
          <div><p className="m-0 text-muted">Category</p><p className="m-0 mt-1 font-semibold">{credential.category}</p></div>
          <div><p className="m-0 text-muted">Issue date</p><p className="m-0 mt-1 font-semibold">{new Date(credential.awardDate).toLocaleDateString()}</p></div>
          <div><p className="m-0 text-muted">Issuer</p><p className="m-0 mt-1 font-semibold">{credential.issuer}</p></div>
          <div><p className="m-0 text-muted">Status</p><p className="m-0 mt-1 font-semibold text-emerald-800">Valid</p></div>
          <div className="sm:col-span-2"><p className="m-0 text-muted">Credential ID</p><p className="m-0 mt-1 break-all font-mono text-micro">{credential.id}</p></div>
        </div>
        <p className="mb-0 mt-6 text-small font-medium">{credential.evaluationAuthority}</p>
      </section>
    </main>
  );
}
