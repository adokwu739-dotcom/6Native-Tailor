import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LogOut, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "./media";

type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type AccountForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const emptyForm: AccountForm = { name: "", email: "", password: "", confirmPassword: "" };

export function AccountPage() {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState(emptyForm);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<CustomerProfile>("/api/customers/me")
      .then((profile) => {
        if (active) setCustomer(profile);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (!(reason instanceof Error) || !reason.message.includes("sign-in")) {
          setError(reason instanceof Error ? reason.message : "Could not check your account.");
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "register" && form.password !== form.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const profile = await apiRequest<CustomerProfile>(`/api/customers/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          ...(mode === "register" ? { name: form.name } : {}),
        }),
      });
      setCustomer(profile);
      setForm(emptyForm);
      setNotice(mode === "register" ? "Your account is ready." : "Welcome back.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await apiRequest<{ status: string }>("/api/customers/logout", { method: "POST" });
      setCustomer(null);
      setNotice("You have signed out.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-page">
      <header className="account-heading">
        <p className="eyebrow"><span />YOUR 6NATIVE ACCOUNT</p>
        <h1>A little space<br /><em>of your own.</em></h1>
        <p>Keep your details close and stay connected with the atelier.</p>
      </header>

      {checking ? (
        <div className="account-card account-loading" role="status">Checking your account…</div>
      ) : customer ? (
        <section className="account-card account-profile">
          <div className="account-icon"><UserRound size={22} /></div>
          <p className="eyebrow">YOUR PROFILE</p>
          <h2>Welcome, {customer.name}.</h2>
          <p className="account-email">{customer.email}</p>
          <div className="account-note"><p>For custom orders and garment care, our Abuja atelier is always happy to help.</p><Link className="text-link" to="/customer-care">Contact customer care <ArrowRight size={15} /></Link></div>
          <button className="account-signout" type="button" onClick={signOut} disabled={busy}><LogOut size={15} />{busy ? "Signing out…" : "Sign out"}</button>
        </section>
      ) : (
        <section className="account-card">
          <div className="account-tabs" role="group" aria-label="Account access">
            <button type="button" aria-pressed={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
            <button type="button" aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          </div>
          <h2>{mode === "register" ? "Welcome to 6Native." : "Good to see you again."}</h2>
          <p className="account-form-intro">{mode === "register" ? "Create an account with your name and email address." : "Sign in with the email address you registered with."}</p>
          <form className="account-form" onSubmit={submit}>
            {mode === "register" && <label>Your name<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={120} required /></label>}
            <label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={254} required /></label>
            <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={mode === "register" ? 12 : 1} maxLength={1024} required />{mode === "register" && <span>Use at least 12 characters.</span>}</label>
            {mode === "register" && <label>Confirm password<input type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} minLength={12} maxLength={1024} required /></label>}
            {error && <p className="account-error" role="alert">{error}</p>}
            {notice && <p className="account-success" role="status">{notice}</p>}
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create my account" : "Sign in"} <ArrowRight size={15} /></button>
          </form>
          <p className="account-privacy">Your account is for your profile only. Custom order requests are still arranged directly with the atelier.</p>
        </section>
      )}
    </section>
  );
}
