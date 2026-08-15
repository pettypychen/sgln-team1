import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  getParticipantEmail,
  getParticipantName,
  setParticipantEmail,
  setParticipantName,
} from "@/participant/session";

export function LoginPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  if (getParticipantName() && getParticipantEmail()) return <Navigate to="/" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    setParticipantName(trimmedName);
    setParticipantEmail(trimmedEmail);
    navigate("/", { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#eeede9] p-6 text-ink">
      <form onSubmit={submit} className="w-full max-w-md rounded-panel bg-white p-8 soft-edge">
        <p className="m-0 text-micro font-semibold uppercase tracking-[0.18em] text-muted">Workplace simulation</p>
        <h1 className="mt-3 font-display text-[36px] font-light">Welcome</h1>
        <p className="text-small text-muted-deep">Enter your details to get started. No account required.</p>
        <label className="mt-6 grid gap-2 text-small font-medium">Your name
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Chen"
            className="rounded-button border border-hairline px-4 py-3"
          />
        </label>
        <label className="mt-4 grid gap-2 text-small font-medium">Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alex@example.com"
            className="rounded-button border border-hairline px-4 py-3"
          />
        </label>
        <button type="submit" className="mt-6 w-full rounded-button bg-black px-5 py-3 text-small font-semibold text-white">Continue</button>
      </form>
    </main>
  );
}
