import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, ExternalLink, QrCode } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "./media";

type ClothingCertificate = {
  id: string;
  order_reference: string;
  garment: string;
  fabric: string;
  tailoring_date: string;
  care_instructions: string;
  authenticity_info: string | null;
  issued_at: string;
};

const initialForm = {
  order_reference: "",
  garment: "",
  fabric: "",
  tailoring_date: "",
  care_instructions: "",
  authenticity_info: "",
};

function certificateUrl(id: string) {
  return `${window.location.origin}/certificate/${id}`;
}

function downloadQrCode(id: string) {
  const svg = document.getElementById(`certificate-qr-${id}`);
  if (!(svg instanceof SVGSVGElement)) return false;
  const downloadUrl = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `6native-certificate-${id}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  return true;
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function CertificatePage() {
  const { id = "" } = useParams();
  const [certificate, setCertificate] = useState<ClothingCertificate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setCertificate(null);
    setError("");
    apiRequest<ClothingCertificate>(`/api/certificates/${encodeURIComponent(id)}`)
      .then((result) => {
        if (active) setCertificate(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "This certificate could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return <section className="certificate-message"><BadgeCheck size={30} /><h1>Certificate unavailable</h1><p>{error}</p><Link className="text-link" to="/">Return to 6Native Tailor <ArrowRight size={15} /></Link></section>;
  }
  if (!certificate) {
    return <section className="certificate-message" role="status">Loading clothing certificate…</section>;
  }

  return (
    <article className="certificate-page">
      <header className="certificate-header">
        <p className="eyebrow"><span />6NATIVE TAILOR · DIGITAL CLOTHING CERTIFICATE</p>
        <BadgeCheck size={33} strokeWidth={1.3} />
        <h1>Made with<br /><em>meaning.</em></h1>
        <p>A record of a garment thoughtfully tailored in our Abuja atelier.</p>
      </header>
      <section className="certificate-details" aria-label="Garment details">
        <div><span>ORDER REFERENCE</span><strong>{certificate.order_reference}</strong></div>
        <div><span>GARMENT</span><strong>{certificate.garment}</strong></div>
        <div><span>FABRIC</span><strong>{certificate.fabric}</strong></div>
        <div><span>TAILORING DATE</span><strong>{formattedDate(certificate.tailoring_date)}</strong></div>
      </section>
      <section className="certificate-care">
        <p className="eyebrow">GARMENT CARE</p>
        <h2>Keep it lovely.</h2>
        <p>{certificate.care_instructions}</p>
      </section>
      {certificate.authenticity_info && (
        <section className="certificate-authenticity">
          <BadgeCheck size={19} />
          <div><p className="eyebrow">ATELIER NOTE</p><p>{certificate.authenticity_info}</p></div>
        </section>
      )}
      <footer className="certificate-footer">
        <span>Issued {formattedDate(certificate.issued_at)}</span>
        <button type="button" className="button button-dark" onClick={() => window.print()}>Print certificate</button>
      </footer>
    </article>
  );
}

export function CertificateAdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [certificates, setCertificates] = useState<ClothingCertificate[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{ email: string }>("/api/admin/session")
      .then(() => {
        if (active) setAuthorized(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setAuthorized(false);
        if (reason instanceof Error && !reason.message.includes("sign-in")) setError(reason.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    apiRequest<ClothingCertificate[]>("/api/admin/certificates")
      .then((result) => {
        if (active) setCertificates(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load certificates.");
      });
    return () => {
      active = false;
    };
  }, [authorized]);

  async function issueCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const certificate = await apiRequest<ClothingCertificate>("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, authenticity_info: form.authenticity_info || null }),
      });
      setCertificates((items) => [certificate, ...items]);
      setForm(initialForm);
      setNotice(`Certificate issued for ${certificate.order_reference}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not issue this certificate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="certificate-admin">
      <header className="admin-heading">
        <div><p className="eyebrow"><span />ATELIER MANAGEMENT</p><h1>Clothing <em>certificates.</em></h1><p>Issue a care and provenance record when a custom garment is complete.</p></div>
        <Link className="text-link" to="/admin">Image library <ArrowRight size={15} /></Link>
      </header>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="certificate-notice" role="status">{notice}</p>}
      {checking ? <p className="admin-status" role="status">Checking admin access…</p> : !authorized ? (
        <div className="certificate-login-note"><p>Sign in to the admin area before issuing a certificate.</p><Link className="button button-dark" to="/admin">Go to admin sign in <ArrowRight size={15} /></Link></div>
      ) : (
        <>
          <form className="certificate-form" onSubmit={issueCertificate}>
            <h2><BadgeCheck size={19} /> Issue a certificate</h2>
            <p>Only garment and order details are published. Do not enter a customer's name, contact details, or private measurements.</p>
            <div className="certificate-form-grid">
              <label>Order reference<input value={form.order_reference} onChange={(event) => setForm({ ...form, order_reference: event.target.value })} maxLength={80} required /></label>
              <label>Garment<input value={form.garment} onChange={(event) => setForm({ ...form, garment: event.target.value })} maxLength={120} required /></label>
              <label>Fabric<input value={form.fabric} onChange={(event) => setForm({ ...form, fabric: event.target.value })} maxLength={120} required /></label>
              <label>Tailoring date<input type="date" value={form.tailoring_date} onChange={(event) => setForm({ ...form, tailoring_date: event.target.value })} required /></label>
              <label className="certificate-wide">Care instructions<textarea rows={4} value={form.care_instructions} onChange={(event) => setForm({ ...form, care_instructions: event.target.value })} maxLength={2000} required placeholder="Washing, drying, ironing and storage guidance…" /></label>
              <label className="certificate-wide">Authenticity information <span className="optional">Optional</span><textarea rows={3} value={form.authenticity_info} onChange={(event) => setForm({ ...form, authenticity_info: event.target.value })} maxLength={1000} placeholder="An atelier note, maker name, or provenance detail…" /></label>
            </div>
            <button type="submit" className="button button-dark" disabled={busy}>{busy ? "Issuing…" : "Issue certificate"} <ArrowRight size={15} /></button>
          </form>

          <section className="certificate-library">
            <div className="admin-library-heading"><p className="eyebrow"><span />COMPLETED CUSTOM OUTFITS</p><h2>Issued certificates <span>({certificates.length})</span></h2></div>
            {certificates.length ? certificates.map((certificate) => {
              const url = certificateUrl(certificate.id);
              return (
                <article className="certificate-record" key={certificate.id}>
                  <QRCodeSVG id={`certificate-qr-${certificate.id}`} value={url} size={112} level="M" title={`QR code for order ${certificate.order_reference}`} />
                  <div><p className="eyebrow">{certificate.order_reference}</p><h3>{certificate.garment}</h3><span>{certificate.fabric} · {formattedDate(certificate.tailoring_date)}</span><a href={url} target="_blank" rel="noreferrer">Open certificate <ExternalLink size={14} /></a><button type="button" onClick={() => { if (!downloadQrCode(certificate.id)) setError("The QR code is not ready to download."); }}>Download QR code</button></div>
                  <QrCode className="certificate-record-icon" size={18} />
                </article>
              );
            }) : <p className="admin-status">No certificates issued yet.</p>}
          </section>
        </>
      )}
    </section>
  );
}
