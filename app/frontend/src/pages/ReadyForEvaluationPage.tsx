import { Link } from "react-router-dom";

/** Route target only; full evaluation page design is intentionally out of scope. */
export function ReadyForEvaluationPage() {
  return (
    <main className="min-h-screen bg-white p-6 text-ink">
      <h1 className="m-0 font-display text-[34px] font-light">
        Ready for Evaluation
      </h1>
      <Link className="mt-4 inline-block text-label text-muted-deep" to="/">
        Return to dashboard
      </Link>
    </main>
  );
}
