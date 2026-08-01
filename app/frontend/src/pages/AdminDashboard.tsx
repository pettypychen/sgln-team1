import { useEffect, useMemo, useState, type FormEvent } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SESSION_KEY = "simworks_admin";

interface AiCallLog {
  id: string;
  callType: "chat" | "evaluation";
  submissionId: string;
  datetime: string;
  userName: string;
  provider: string;
  aiModel: string;
  promptPreview: string;
  status: "processing" | "complete";
  response: string;
  completedAt: string | null;
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (id === "admin" && password === "admin") {
      onLogin();
    } else {
      setError("Invalid credentials.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
      <form onSubmit={submit} className="w-full max-w-md rounded-panel bg-white p-8 soft-edge">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">System access</p>
        <h1 className="mt-3 font-display text-[36px] font-light">Admin dashboard</h1>
        <p className="text-small text-muted-deep">Internal monitoring of AI backend calls.</p>
        <label className="mt-6 grid gap-2 text-small font-medium">Admin ID
          <input required autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} className="rounded-button border border-hairline px-4 py-3 text-ink" />
        </label>
        <label className="mt-4 grid gap-2 text-small font-medium">Password
          <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-button border border-hairline px-4 py-3 text-ink" />
        </label>
        {error ? <p role="alert" className="mt-3 text-small text-red-700">{error}</p> : null}
        <button className="mt-6 w-full rounded-button bg-black px-5 py-3 text-small font-semibold text-white">Sign in</button>
      </form>
    </main>
  );
}

function StatusBadge({ status }: { status: "processing" | "complete" }) {
  return status === "processing"
    ? <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-micro font-semibold text-amber-800">Processing</span>
    : <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-micro font-semibold text-emerald-800">Complete</span>;
}

function CallTypeBadge({ type }: { type: "chat" | "evaluation" }) {
  return type === "chat"
    ? <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-micro font-semibold text-blue-800">Chat</span>
    : <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-micro font-semibold text-violet-800">Evaluation</span>;
}

function AdminContent({ onLogout }: { onLogout: () => void }) {
  const [logs, setLogs] = useState<AiCallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!db) { setLoading(false); setError("Firebase is not configured."); return; }
    getDocs(collection(db, "aiCallLogs"))
      .then((snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AiCallLog));
        loaded.sort((a, b) => b.datetime.localeCompare(a.datetime));
        setLogs(loaded);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load logs."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const cutoff = dateFilter !== "all"
      ? new Date(Date.now() - Number(dateFilter) * 86400_000).toISOString()
      : null;
    const q = search.toLowerCase();
    return logs.filter((log) => {
      if (callTypeFilter !== "all" && log.callType !== callTypeFilter) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (cutoff && log.datetime < cutoff) return false;
      if (q && !log.submissionId.toLowerCase().includes(q) && !log.userName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, callTypeFilter, statusFilter, dateFilter, search]);

  const processingCount = logs.filter((l) => l.status === "processing").length;
  const chatCount = logs.filter((l) => l.callType === "chat").length;
  const evalCount = logs.filter((l) => l.callType === "evaluation").length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-[#eeede9] p-4 text-ink md:p-7">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Internal · backend monitoring</p>
            <h1 className="m-0 mt-2 font-display text-[42px] font-light">AI call logs</h1>
          </div>
          <button onClick={onLogout} className="rounded-button bg-white px-4 py-2 text-small soft-edge">Sign out</button>
        </header>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ["Total calls", logs.length],
            ["Processing", processingCount],
            ["Chat calls", chatCount],
            ["Evaluation calls", evalCount],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-panel bg-white p-4 soft-edge">
              <p className="m-0 text-micro text-muted">{label}</p>
              <p className="m-0 mt-2 font-display text-3xl">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-panel bg-white p-4 soft-edge">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-micro text-muted">Call type
              <select value={callTypeFilter} onChange={(e) => setCallTypeFilter(e.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink">
                <option value="all">All types</option>
                <option value="chat">Chat</option>
                <option value="evaluation">Evaluation</option>
              </select>
            </label>
            <label className="grid gap-1 text-micro text-muted">Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink">
                <option value="all">All statuses</option>
                <option value="processing">Processing</option>
                <option value="complete">Complete</option>
              </select>
            </label>
            <label className="grid gap-1 text-micro text-muted">Date range
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-button border border-hairline bg-white px-3 py-2 text-small text-ink">
                <option value="all">Any date</option>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="grid gap-1 text-micro text-muted">Search
              <input
                type="search"
                placeholder="Submission ID or username…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-button border border-hairline px-3 py-2 text-small text-ink"
              />
            </label>
          </div>
        </section>

        {loading ? <p className="mt-8 text-muted-deep">Loading logs…</p> : null}
        {error ? <div role="alert" className="mt-6 rounded-panel border border-red-300 bg-red-50 p-4 text-small text-red-900">{error}</div> : null}
        {!loading && !error && filtered.length === 0 ? (
          <div className="mt-6 rounded-panel bg-white p-8 text-center text-muted-deep soft-edge">No logs match these filters.</div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <section className="mt-5 overflow-x-auto rounded-panel bg-white soft-edge">
            <table className="w-full min-w-[900px] border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Type</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Datetime</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Username</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Submission ID</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">AI model</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Status</th>
                  <th className="px-4 py-3 text-micro font-semibold text-muted">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const isOpen = expanded.has(log.id);
                  return (
                    <>
                      <tr key={log.id} className="border-b border-hairline hover:bg-[#fafaf8]">
                        <td className="px-4 py-3"><CallTypeBadge type={log.callType} /></td>
                        <td className="px-4 py-3 text-micro text-muted-deep whitespace-nowrap">{new Date(log.datetime).toLocaleString()}</td>
                        <td className="px-4 py-3">{log.userName || <span className="text-muted">—</span>}</td>
                        <td className="px-4 py-3 font-mono text-micro">{log.submissionId ? log.submissionId.slice(0, 12) + "…" : <span className="text-muted">—</span>}</td>
                        <td className="px-4 py-3 text-micro">{log.provider} / {log.aiModel}</td>
                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="rounded-button bg-cloud px-3 py-1 text-micro font-semibold"
                          >
                            {isOpen ? "Collapse" : "Expand"}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${log.id}-detail`} className="border-b border-hairline bg-[#f8f7f3]">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <p className="m-0 text-micro font-semibold uppercase tracking-wide text-muted">Prompt sent</p>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-button bg-white p-3 font-mono text-micro text-ink soft-edge">{log.promptPreview || "—"}</pre>
                              </div>
                              <div>
                                <p className="m-0 text-micro font-semibold uppercase tracking-wide text-muted">Response {log.completedAt ? `· ${new Date(log.completedAt).toLocaleString()}` : ""}</p>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-button bg-white p-3 font-mono text-micro text-ink soft-edge">{log.response || "—"}</pre>
                              </div>
                            </div>
                            {log.submissionId ? (
                              <p className="mt-3 text-micro text-muted">Full submission ID: <span className="font-mono">{log.submissionId}</span></p>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}

        <p className="mt-4 text-micro text-muted">{filtered.length} of {logs.length} logs shown</p>
      </div>
    </main>
  );
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState(() => Boolean(sessionStorage.getItem(SESSION_KEY)));

  if (!authed) {
    return <AdminLogin onLogin={() => { sessionStorage.setItem(SESSION_KEY, "1"); setAuthed(true); }} />;
  }
  return <AdminContent onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} />;
}
