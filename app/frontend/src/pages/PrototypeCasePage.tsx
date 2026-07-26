import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  KOPI_RUN_CONTENT,
  MONTH_END_CLOSE_CONTENT,
} from "@/content/simulations";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  AgentNotConfiguredError,
  sendAgentTurn,
} from "@/lib/agentClient";
import type { TranscriptMessage } from "@/evaluation/types";

type PrototypeContent =
  | typeof MONTH_END_CLOSE_CONTENT
  | typeof KOPI_RUN_CONTENT;

const CONTENT: Record<string, PrototypeContent> = {
  [MONTH_END_CLOSE_CONTENT.id]: MONTH_END_CLOSE_CONTENT,
  [KOPI_RUN_CONTENT.id]: KOPI_RUN_CONTENT,
};

interface CaseState {
  messages: TranscriptMessage[];
  workProduct: string;
}

function demoReply(caseId: string) {
  return caseId === "kopi-run"
    ? "I can organize the six constraints, but I should not guess ambiguous preferences. Which colleague needs clarification, and which requested menu item is unavailable?"
    : "I can compare the ledger, checklist, and manager notes. Ask me to identify a source-backed exception or verify a calculation, then challenge anything that is not tied to a row or note.";
}

function readinessFor(caseId: string, state: CaseState) {
  const learnerText = state.messages
    .filter((message) => message.role === "learner")
    .map((message) => message.content)
    .join(" ");
  const combined = `${learnerText} ${state.workProduct}`.toLowerCase();
  const shared = [
    {
      label: "Worked with the AI for at least two turns",
      ready: state.messages.filter((message) => message.role === "learner").length >= 2,
    },
    {
      label: "Prepared a substantive final work product",
      ready: state.workProduct.trim().length >= 80,
    },
  ];
  if (caseId === "kopi-run") {
    return [
      ...shared,
      { label: "Clarified Dev's ambiguous preference", ready: /dev|clarif|which drink/.test(combined) },
      { label: "Handled Elena's unavailable combination", ready: /elena|unavailable|substitut|alternative/.test(combined) },
      { label: "Verified prices and total", ready: /price|total|sgd/.test(combined) },
      { label: "Corrected an AI mistake", ready: /correct|mistake|wrong|recalculat/.test(combined) },
    ];
  }
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
  const [activeArtifact, setActiveArtifact] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = usePersistentState<CaseState>(
    `simworks:${caseId}`,
    { messages: [], workProduct: "" },
  );
  const readiness = useMemo(
    () => readinessFor(caseId, state),
    [caseId, state],
  );
  const ready = readiness.every((item) => item.ready);

  if (!content) return <Navigate to="/" replace />;

  async function send(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || sending) return;
    setError("");
    const learner: TranscriptMessage = {
      id: crypto.randomUUID(),
      role: "learner",
      content: value,
      status: "sent",
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...state.messages, learner];
    setState({ ...state, messages: nextMessages });
    setPrompt("");
    setSending(true);
    try {
      let response: string;
      try {
        response = await sendAgentTurn({
          system: `${content.caseMarkdown}\n\nSource artifacts:\n${content.artifacts.map((item) => `## ${item.id}\n${item.content}`).join("\n\n")}\n\nCoach without revealing the complete answer. Ground claims in supplied sources.`,
          messages: nextMessages.map((message) => ({
            role: message.role === "learner" ? "user" : "assistant",
            content: message.content,
          })),
        });
      } catch (reason) {
        if (!(reason instanceof AgentNotConfiguredError)) throw reason;
        response = demoReply(caseId);
      }
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: "agent",
            content: response,
            status: "sent",
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The case agent failed.");
    } finally {
      setSending(false);
    }
  }

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
            Submit for evaluation
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
          <pre className="mt-4 max-h-[66vh] overflow-auto whitespace-pre-wrap rounded-panel bg-[#f8f7f3] p-5 font-mono text-small leading-relaxed">{activeArtifact === -1 ? content.caseMarkdown : content.artifacts[activeArtifact].content}</pre>
          <div className="mt-5"><h2 className="m-0 text-label">Completion evidence</h2><ul className="mt-3 grid gap-2 p-0">{readiness.map((item) => <li key={item.label} className="flex list-none items-center gap-2 text-small"><span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full text-micro ${item.ready ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-600"}`}>{item.ready ? "✓" : "○"}</span>{item.label}</li>)}</ul></div>
        </section>

        <section className="grid min-w-0 gap-4">
          <div className="rounded-panel bg-white p-5 soft-edge"><p className="m-0 text-micro font-semibold uppercase tracking-[.16em] text-muted">AI case agent</p><div aria-live="polite" className="mt-4 grid max-h-72 gap-3 overflow-y-auto">{state.messages.length ? state.messages.map((message) => <div key={message.id} className={`rounded-panel p-3 text-small ${message.role === "learner" ? "ml-8 bg-[#f3eee4]" : "mr-8 bg-cloud"}`}><strong className="text-micro uppercase text-muted">{message.role}</strong><p className="mb-0 mt-1 whitespace-pre-wrap">{message.content}</p></div>) : <p className="text-small text-muted-deep">{demoReply(caseId)}</p>}</div>
            <form onSubmit={send} className="mt-4 flex gap-2"><label className="sr-only" htmlFor="case-prompt">Message the case agent</label><textarea id="case-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-20 flex-1 rounded-button border border-hairline p-3 text-small" placeholder="Ask a source-grounded question…" /><button disabled={sending || !prompt.trim()} className="self-end rounded-button bg-black px-4 py-2.5 text-small font-semibold text-white disabled:opacity-40">{sending ? "Sending…" : "Send"}</button></form>{error ? <p role="alert" className="mb-0 text-small text-red-900">{error}</p> : null}
          </div>
          <div className="rounded-panel bg-white p-5 soft-edge"><label htmlFor="work-product" className="text-micro font-semibold uppercase tracking-[.16em] text-muted">Final work product</label><textarea id="work-product" value={state.workProduct} onChange={(event) => setState({ ...state, workProduct: event.target.value })} className="mt-3 min-h-72 w-full rounded-panel border border-hairline p-4 font-mono text-small" placeholder={caseId === "kopi-run" ? "| Colleague | Item code | Translated order | Price |" : "Exception table, calculations, prioritized blockers, and manager update…"} /></div>
        </section>
      </div>
    </main>
  );
}
