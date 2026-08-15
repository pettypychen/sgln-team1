import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  KOPI_RUN_CONTENT,
  MONTH_END_CLOSE_CONTENT,
} from "@/content/simulations";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { ChatMessage } from "@/types";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { CaseSubmissionPanel } from "@/components/simulation/CaseSubmissionPanel";
import { CsvTable } from "@/components/ui/CsvTable";
import { KopiMenuCards } from "@/components/ui/KopiMenuCards";
import { MarkdownDocument } from "@/components/ui/MarkdownDocument";

type PrototypeContent =
  | typeof MONTH_END_CLOSE_CONTENT
  | typeof KOPI_RUN_CONTENT;

const CONTENT: Record<string, PrototypeContent> = {
  [MONTH_END_CLOSE_CONTENT.id]: MONTH_END_CLOSE_CONTENT,
  [KOPI_RUN_CONTENT.id]: KOPI_RUN_CONTENT,
};

interface CaseState {
  chatMessages: ChatMessage[];
  workProduct: string;
}

function demoReply(caseId: string) {
  return caseId === "kopi-run"
    ? "Pick one colleague and ask me to check the matching menu code. I’ll explain the match using the supplied menu and glossary."
    : "I can compare the ledger, checklist, and manager notes. Ask me to identify a source-backed exception or verify a calculation, then challenge anything that is not tied to a row or note.";
}

function readinessFor(
  caseId: string,
  messages: ChatMessage[],
  workProduct: string,
) {
  const learnerText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join(" ");
  const combined = `${learnerText} ${workProduct}`.toLowerCase();
  if (caseId === "kopi-run") {
    return [
      {
        label: "Asked the AI to check at least one order",
        ready: messages.some((message) => message.role === "user"),
      },
      {
        label: "Included all three colleagues",
        ready: /aiman/.test(combined) && /beatrice/.test(combined) && /cheryl/.test(combined),
      },
      {
        label: "Included menu codes and a total",
        ready: /k0[1-6]/.test(combined) && /total|sgd/.test(combined),
      },
    ];
  }
  const shared = [
    {
      label: "Worked with the AI for at least two turns",
      ready: messages.filter((message) => message.role === "user").length >= 2,
    },
    {
      label: "Prepared a substantive final work product",
      ready: workProduct.trim().length >= 80,
    },
  ];
  return [
    ...shared,
    { label: "Documented source-backed exceptions", ready: /exception|duplicate|accrual|unposted/.test(combined) },
    { label: "Prioritized close blockers", ready: /blocker|priority|prioriti/.test(combined) },
    { label: "Verified calculations", ready: /recalculat|total|verified|calculation/.test(combined) },
  ];
}

export function PrototypeCasePage() {
  const { caseId = "" } = useParams();
  const navigate = useNavigate();
  const content = CONTENT[caseId];
  const [activeArtifact, setActiveArtifact] = useState(-1);
  const [state, setState] = usePersistentState<CaseState>(
    `simworks:${caseId}`,
    { chatMessages: [], workProduct: "" },
  );
  const chatMessages = state.chatMessages ?? [];
  const workProduct = state.workProduct ?? "";
  const readiness = useMemo(
    () => readinessFor(caseId, chatMessages, workProduct),
    [caseId, chatMessages, workProduct],
  );
  const ready = readiness.every((item) => item.ready);

  const systemPrompt = useMemo(
    () =>
      content
        ? `${content.caseMarkdown}\n\nSource artifacts:\n${content.artifacts
            .map((item) => `## ${item.id}\n${item.content}`)
            .join("\n\n")}\n\nCoach without revealing the complete answer. Ground claims in supplied sources.`
        : "",
    [content],
  );

  if (!content) return <Navigate to="/" replace />;

  const selectedArtifact =
    activeArtifact === -1 ? null : content.artifacts[activeArtifact];
  const sourceContent =
    activeArtifact === -1
      ? content.caseMarkdown
      : selectedArtifact?.content ?? "";
  const sourceIsMarkdown =
    activeArtifact === -1 || selectedArtifact?.id.endsWith(".md");
  const sourceIsCsv = selectedArtifact?.id.endsWith(".csv");
  const sourceIsKopiMenu = selectedArtifact?.id === "kopi-menu.csv";

  return (
    <main className="min-h-screen bg-[#eeede9] text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-button bg-cloud px-4 py-2 text-small font-semibold text-ink">Back</Link>
            <div><p className="m-0 text-micro text-muted">{content.category} · Case 1.0.0 · Rubric 1.0.0</p><h1 className="m-0 text-label font-semibold">{content.title}</h1></div>
          </div>
          <button
            disabled={!ready}
            onClick={() => navigate(`/simulations/${caseId}/ready`)}
            className="rounded-button bg-black px-5 py-2.5 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review and submit
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1680px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(440px,.8fr)] md:p-6">
        <section className="min-w-0 rounded-panel bg-white p-5 soft-edge">
          <p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">Source workspace</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setActiveArtifact(-1)} className={`rounded-button px-3 py-2 text-small font-semibold ${activeArtifact === -1 ? "bg-black text-white" : "bg-cloud"}`}>Instructions</button>
            {content.artifacts.map((artifact, index) => (
              <button key={artifact.id} onClick={() => setActiveArtifact(index)} className={`rounded-button px-3 py-2 text-small font-semibold ${activeArtifact === index ? "bg-black text-white" : "bg-cloud"}`}>{artifact.label}</button>
            ))}
          </div>
          <div className="mt-4 max-h-[66vh] overflow-auto rounded-panel bg-[#f8f7f3] p-5">
            {sourceIsKopiMenu ? (
              <KopiMenuCards content={sourceContent} />
            ) : sourceIsCsv ? (
              <CsvTable content={sourceContent} />
            ) : sourceIsMarkdown ? (
              <MarkdownDocument content={sourceContent} />
            ) : (
              <pre className="m-0 whitespace-pre-wrap font-mono text-small leading-relaxed">
                {sourceContent}
              </pre>
            )}
          </div>
        </section>

        <section className="grid min-w-0 gap-4">
          <div className="rounded-panel bg-white p-5 soft-edge">
            <p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">AI case agent</p>
            <CaseChatPanel
              messages={chatMessages}
              onMessagesChange={(nextMessages) =>
                setState((current) => ({
                  chatMessages: nextMessages,
                  workProduct: current.workProduct ?? "",
                }))
              }
              systemPrompt={systemPrompt}
              scriptedFallback={() => demoReply(caseId)}
              placeholder="Ask a source-grounded question…"
              emptyState={
                <p className="m-0 text-small text-muted-deep">{demoReply(caseId)}</p>
              }
              className="mt-4 flex flex-col"
              transcriptClassName="max-h-72 space-y-3 overflow-y-auto"
            />
          </div>
          <CaseSubmissionPanel
            title={caseId === "kopi-run" ? "Your answers" : "Final work product"}
            description={caseId === "kopi-run" ? "Write the order you want evaluated. The chat can help you check it, but this is the submitted answer." : "Write the work product you want evaluated."}
            value={workProduct}
            onChange={(workProduct) =>
              setState((current) => ({
                chatMessages: current.chatMessages ?? [],
                workProduct,
              }))
            }
            textareaId="work-product"
            placeholder={caseId === "kopi-run" ? "Aiman — K03 — Kopi O Kosong — SGD 1.40\nBeatrice — ...\nCheryl — ...\nTotal — SGD ..." : "Exception table, calculations, prioritized blockers, and manager update…"}
            readinessItems={readiness}
          />
        </section>
      </div>
    </main>
  );
}
