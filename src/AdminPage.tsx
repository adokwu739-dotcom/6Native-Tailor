import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ImagePlus, LogOut, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest, type MediaAsset } from "./media";

const imageSlots = [
  { value: "hero-1", label: "Homepage hero — slide 1" },
  { value: "hero-2", label: "Homepage hero — slide 2" },
  { value: "hero-3", label: "Homepage hero — slide 3" },
  { value: "product-season-dress", label: "Product — All-Season Ankara Dress" },
  { value: "product-green-palm-coord", label: "Product — Green Palm Co-ord" },
  { value: "product-purple-agbada", label: "Product — Purple Agbada Set" },
  { value: "product-green-mens-kaftan", label: "Product — Green Men's Kaftan" },
  { value: "homepage-gallery", label: "Add to homepage gallery" },
  { value: "pieces-gallery", label: "Add to Pieces to keep gallery" },
];

type AdminSession = { email: string };

export function AdminPage() {
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alt, setAlt] = useState("");
  const [slot, setSlot] = useState(imageSlots[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<AdminSession>("/api/admin/session")
      .then((session) => {
        if (active) setAdmin(session);
      })
      .catch((reason: unknown) => {
        if (active && reason instanceof Error && !reason.message.includes("sign-in")) {
          setError(reason.message);
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!admin) return;
    let active = true;
    apiRequest<MediaAsset[]>("/api/admin/images")
      .then((result) => {
        if (active) setAssets(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load the image library.");
      });
    return () => {
      active = false;
    };
  }, [admin, refreshKey]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await apiRequest<AdminSession>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setAdmin(session);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Images must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", alt);
    formData.set("slot", slot);
    try {
      await apiRequest<MediaAsset>("/api/admin/images", { method: "POST", body: formData });
      setAlt("");
      setFile(null);
      form.reset();
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload this image.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(asset: MediaAsset) {
    if (!window.confirm(`Remove "${asset.alt}" from the storefront?`)) return;
    setError("");
    try {
      await apiRequest<{ status: string }>(`/api/admin/images/${asset.id}`, { method: "DELETE" });
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove this image.");
    }
  }

  async function signOut() {
    setError("");
    try {
      await apiRequest<{ status: string }>("/api/admin/logout", { method: "POST" });
      setAdmin(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-heading">
        <div>
          <p className="eyebrow"><span />STOREFRONT MANAGEMENT</p>
          <h1>Image <em>library.</em></h1>
          <p>Manage the photographs shown across your storefront.</p>
          {admin && <Link className="text-link admin-certificate-link" to="/admin/certificates">Manage clothing certificates <ArrowRight size={15} /></Link>}
        </div>
        {admin && <button className="admin-signout" type="button" onClick={signOut}><LogOut size={16} /> Sign out</button>}
      </header>

      {error && <p className="admin-error" role="alert">{error}</p>}

      {checkingSession ? (
        <p className="admin-status" role="status">Checking admin access…</p>
      ) : admin ? (
        <div className="admin-content">
          <form className="admin-form" onSubmit={uploadImage}>
            <h2><ImagePlus size={19} /> Add a storefront image</h2>
            <label>
              Storefront location
              <select value={slot} onChange={(event) => setSlot(event.target.value)}>
                {imageSlots.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              Image description
              <input value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={120} required placeholder="Describe the image for accessibility" />
            </label>
            <label className="admin-file">
              Image file
              <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <span>{file ? file.name : "Choose JPEG, PNG, or WEBP · up to 10 MB"}</span>
            </label>
            <button className="button button-dark" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Upload image"} <ArrowRight size={16} />
            </button>
            <p className="admin-hint">Uploading to an occupied hero or product location replaces its current image. Gallery uploads are added as new images.</p>
          </form>

          <section className="admin-library" aria-labelledby="admin-library-title">
            <div className="admin-library-heading">
              <div><p className="eyebrow"><span />CURRENT STOREFRONT IMAGES</p><h2 id="admin-library-title">Your library <span>({assets.length})</span></h2></div>
            </div>
            {assets.length ? (
              <div className="admin-image-grid">
                {assets.map((asset) => (
                  <article className="admin-image-card" key={asset.id}>
                    <img src={asset.url} alt={asset.alt} loading="lazy" />
                    <div className="admin-image-details">
                      <strong>{asset.alt}</strong>
                      <span>{imageSlots.find((item) => item.value === asset.slot)?.label ?? asset.slot}</span>
                      <button type="button" onClick={() => removeImage(asset)} aria-label={`Remove ${asset.alt}`}><Trash2 size={15} /> Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="admin-status">No uploaded images yet. Your original storefront images remain in place.</p>}
          </section>
        </div>
      ) : (
        <form className="admin-login" onSubmit={signIn}>
          <h2>Admin sign in</h2>
          <p>This area is for the store administrator.</p>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} /></button>
        </form>
      )}
    </section>
  );
}
