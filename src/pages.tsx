import { useEffect, useState, type FormEvent, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Ruler,
  Scissors,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatNaira, products, type Product } from "./catalog";

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
const measurements = [
  ["bust", "Bust", "Wrap the tape around the fullest part of your chest."],
  ["waist", "Natural waist", "Measure the narrowest part of your waist."],
  ["hip", "Full hip", "Measure around the fullest part of your hips."],
  ["shoulder", "Shoulder width", "Measure from one shoulder edge to the other."],
  ["sleeve", "Sleeve length", "Measure from shoulder edge to your wrist."],
  ["topLength", "Top length", "Measure from your shoulder to the desired hem."],
  ["trouserLength", "Trouser length", "Measure from waist to desired ankle hem."],
  ["dressLength", "Dress length", "Measure from shoulder to your desired hem."],
] as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow"><span />{children}</p>;
}

function PageIntro({ label, title, description }: { label: string; title: ReactNode; description: string }) {
  return (
    <section className="page-intro">
      <Eyebrow>{label}</Eyebrow>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

export function HomePage({ addToBag, saved, toggleSaved }: {
  addToBag: (product: Product) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
}) {
  return (
    <>
      <section className="hero">
        <img className="hero-image" src="/images/teal-ankara-dress.jpeg" alt="Teal and gold Ankara dress displayed on a mannequin" />
        <div className="hero-overlay" />
        <div className="hero-copy">
          <Eyebrow>Made with meaning, worn with ease</Eyebrow>
          <h1>Rooted in<br />where we’re <em>going.</em></h1>
          <p className="hero-description">Thoughtful African design, made slowly and beautifully for the way you live now.</p>
          <Link className="button button-light" to="/shop">Explore the collection <ArrowRight size={16} /></Link>
        </div>
        <div className="hero-caption"><span>01 / 03</span><span>THE EVERYDAY HEIRLOOMS EDIT</span></div>
        <a className="hero-scroll" href="#home-services" aria-label="Scroll to services"><ArrowDownRight size={16} /></a>
      </section>

      <section className="intro">
        <Eyebrow>A different kind of fashion house</Eyebrow>
        <h2>Made for your life.<br /><em>Made to feel like you.</em></h2>
        <p className="intro-text">We bring the spirit of African craft into pieces you’ll reach for again and again. Considered in every detail. Made close to home. Always, unmistakably yours.</p>
        <Link className="text-link" to="/our-story">Get to know us <ArrowRight size={15} /></Link>
        <span className="intro-stamp">ABUJA<br />NIGERIA<br /><b>09°04′N · 07°29′E</b></span>
      </section>

      <section className="home-services" id="home-services">
        <div className="section-heading">
          <div><Eyebrow>Made for the way you wear</Eyebrow><h2>Find your way <em>in.</em></h2></div>
          <Link className="text-link desktop-link" to="/custom-tailoring">Start something personal <ArrowRight size={15} /></Link>
        </div>
        <div className="service-grid">
          <Link to="/shop" className="service-card service-shop"><span className="service-number">01 / READY TO WEAR</span><h3>Pieces to<br /><em>keep.</em></h3><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
          <Link to="/custom-tailoring" className="service-card service-custom"><span className="service-number">02 / MADE FOR YOU</span><h3>Your idea,<br /><em>beautifully made.</em></h3><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
          <Link to="/style-assistant" className="service-card service-style"><span className="service-number">03 / A LITTLE GUIDANCE</span><h3>Find your<br /><em>next favourite.</em></h3><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
        </div>
        <Link className="text-link mobile-link" to="/custom-tailoring">Start something personal <ArrowRight size={15} /></Link>
      </section>

      <section className="home-featured section-pad">
        <div className="section-heading">
          <div><Eyebrow>Thoughtfully made in Abuja</Eyebrow><h2>Pieces to <em>keep.</em></h2></div>
          <Link className="text-link desktop-link" to="/shop">Shop the collection <ArrowRight size={15} /></Link>
        </div>
        <div className="product-grid">
          {products.slice(0, 3).map((product) => <ProductTile key={product.id} product={product} addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />)}
        </div>
        <Link className="text-link mobile-link" to="/shop">Shop the collection <ArrowRight size={15} /></Link>
      </section>

      <section className="custom-banner">
        <div className="custom-sun" />
        <Eyebrow>Your vision, our hands</Eyebrow>
        <h2>Something made<br /><em>just for you.</em></h2>
        <p>Share your idea, measurements, and inspiration. We’ll take it from first conversation to final fitting.</p>
        <Link className="button button-dark" to="/custom-tailoring">Begin a custom order <ArrowRight size={16} /></Link>
        <span className="banner-flower">✳</span>
      </section>
    </>
  );
}

function ProductTile({ product, addToBag, saved, toggleSaved }: {
  product: Product;
  addToBag?: (product: Product) => void;
  saved?: string[];
  toggleSaved?: (id: string) => void;
}) {
  const isSaved = saved?.includes(product.id) ?? false;
  return (
    <article className="product-card">
      <div className="product-image-wrap" style={{ backgroundColor: product.color }}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {toggleSaved && <button className={`save-button ${isSaved ? "is-saved" : ""}`} onClick={() => toggleSaved(product.id)} aria-label={`${isSaved ? "Remove" : "Save"} ${product.name} ${isSaved ? "from" : "to"} wishlist`} aria-pressed={isSaved}><Heart size={17} fill={isSaved ? "currentColor" : "none"} /></button>}
        {addToBag && <button className="quick-add" onClick={() => addToBag(product)}>Add to bag <span><span className="sr-only">Add</span><ArrowRight size={14} /></span></button>}
      </div>
      <div className="product-info"><div><h3>{product.name}</h3><p>{product.note}</p></div><span>{formatNaira(product.price)}</span></div>
    </article>
  );
}

export function ShopPage({ addToBag, saved, toggleSaved }: {
  addToBag: (product: Product) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
}) {
  const [category, setCategory] = useState("Everything");
  const categories = ["Everything", "Ready to wear", "New arrivals", "Accessories"];
  const visible = category === "Everything" ? products : products.filter((item) => item.category === category);
  return (
    <>
      <PageIntro label="The collection" title={<>Pieces to <em>keep.</em></>} description="Small-batch, thoughtfully finished clothing and accessories, made to be lived in and loved for a long time." />
      <section className="shop-page section-pad">
        <div className="filter-row" role="group" aria-label="Filter products by category">
          {categories.map((item) => <button className={`filter-chip ${category === item ? "active" : ""}`} key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>)}
          <span className="product-count">{visible.length} pieces</span>
        </div>
        <div className="product-grid">
          {visible.map((product) => <ProductTile key={product.id} product={product} addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />)}
        </div>
        <div className="shop-tailoring-note"><Scissors size={19} /><p>Looking for something made around you?</p><Link className="text-link" to="/custom-tailoring">Explore custom tailoring <ArrowRight size={15} /></Link></div>
      </section>
    </>
  );
}

type OrderForm = {
  name: string;
  email: string;
  phone: string;
  garment: string;
  occasion: string;
  fabric: string;
  unit: string;
  notes: string;
  [key: string]: string;
};

const initialOrder: OrderForm = {
  name: "", email: "", phone: "", garment: "Dress", occasion: "", fabric: "", unit: "cm", notes: "",
};

export function CustomOrderPage() {
  const [form, setForm] = useState<OrderForm>(initialOrder);
  const [files, setFiles] = useState<File[]>([]);
  const [formMessage, setFormMessage] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const objectUrls = files.map((file) => URL.createObjectURL(file));
    setPreviews(objectUrls);
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > 3) {
      setFormMessage("Please choose up to 3 reference images.");
      event.target.value = "";
      return;
    }
    if (selected.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setFormMessage("Use image files only, up to 5 MB each.");
      event.target.value = "";
      return;
    }
    setFiles(selected);
    setFormMessage("");
  }

  function shareOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!whatsappNumber) {
      setFormMessage("WhatsApp support is not connected yet. Your measurements and images have not been sent or saved.");
      return;
    }
    const dimensions = measurements
      .map(([key, label]) => form[key] ? `${label}: ${form[key]} ${form.unit}` : "")
      .filter(Boolean)
      .join("\n");
    const text = [
      "Hello 6Native Tailor, I would like to discuss a custom garment.",
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone || "Not provided"}`,
      `Garment: ${form.garment}`,
      `Occasion: ${form.occasion || "Not specified"}`,
      `Fabric preference: ${form.fabric || "Please advise"}`,
      dimensions ? `Measurements:\n${dimensions}` : "Measurements: I would like help taking them.",
      `Design notes: ${form.notes || "I would like to discuss the design."}`,
      files.length ? `I have ${files.length} reference image(s); I will attach them in this chat.` : "",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setFormMessage("Your message opened in WhatsApp. Attach your reference pictures in that chat before sending.");
  }

  return (
    <>
      <PageIntro label="Custom tailoring · Abuja" title={<>Your idea,<br /><em>beautifully made.</em></>} description="Tell our Abuja atelier what you have in mind. Share your measurements, a sketch or inspiration photo, and we’ll help turn it into a garment made for you." />
      <section className="custom-order-layout">
        <form className="custom-order-form" onSubmit={shareOrder}>
          <div className="form-section">
            <div className="form-heading"><span>01</span><div><h2>Let’s meet you.</h2><p>So our team knows who we’re making for.</p></div></div>
            <div className="form-grid">
              <label>Your name<input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required /></label>
              <label>Email address<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
              <label>WhatsApp / phone <span className="optional">Optional</span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" /></label>
              <label>What are we making?<select value={form.garment} onChange={(event) => update("garment", event.target.value)}><option>Dress</option><option>Two-piece set</option><option>Shirt or top</option><option>Trousers or skirt</option><option>Traditional wear</option><option>Something else</option></select></label>
              <label>Occasion or when you need it <span className="optional">Optional</span><input value={form.occasion} onChange={(event) => update("occasion", event.target.value)} placeholder="A wedding, everyday, a date…" /></label>
              <label>Fabric or colour ideas <span className="optional">Optional</span><input value={form.fabric} onChange={(event) => update("fabric", event.target.value)} placeholder="Or ask us for suggestions" /></label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-heading"><span>02</span><div><h2>Your measurements.</h2><p>Share what you know; our tailor can guide you through the rest.</p></div></div>
            <label className="unit-picker">Measurement unit<select value={form.unit} onChange={(event) => update("unit", event.target.value)}><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></label>
            <div className="measurement-grid">
              {measurements.map(([key, label, hint]) => (
                <label key={key} title={hint}>{label}<div className="measurement-input"><input type="number" min="0" max="300" step="0.1" value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} placeholder="—" /><span>{form.unit}</span></div></label>
              ))}
            </div>
            <Link className="inline-guide" to="/fit-guide"><Ruler size={15} /> Need help measuring? See our step-by-step guide <ArrowRight size={14} /></Link>
            <p className="privacy-note">Measurements are personal. They stay in this browser until you choose to open WhatsApp and share the text yourself.</p>
          </div>

          <div className="form-section">
            <div className="form-heading"><span>03</span><div><h2>Show us what you mean.</h2><p>Add a reference photo, a sketch, or the feeling you have in mind.</p></div></div>
            <label className="upload-zone">
              <input type="file" accept="image/*" multiple onChange={chooseFiles} />
              <ImagePlus size={25} strokeWidth={1.3} />
              <b>Choose reference images</b><span>PNG, JPG or WEBP · Up to 3 images · 5 MB each</span>
            </label>
            {previews.length > 0 && <div className="preview-row">{previews.map((url, index) => <img src={url} alt={`Design reference ${index + 1} preview`} key={url} />)}</div>}
            <p className="privacy-note">Images are previewed locally and are not uploaded. If you send the WhatsApp message, you’ll need to attach them in that chat.</p>
            <label className="notes-label">Anything else we should know?<textarea rows={4} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Fit, colour, details you love, what you want to feel like…" /></label>
          </div>

          <div className="form-submit">
            <button type="submit" className="button button-dark">Review with our atelier <ArrowRight size={16} /></button>
            <p>Nothing is sent unless you choose to continue in WhatsApp.</p>
            {formMessage && <div className="form-status" role="status">{formMessage}</div>}
          </div>
        </form>

        <aside className="order-aside">
          <div className="order-aside-card"><span className="aside-icon"><Scissors size={20} /></span><Eyebrow>How custom works</Eyebrow><h3>A good fit<br /><em>starts with a chat.</em></h3><ol><li><b>Tell us your idea</b><span>Share the design, references and details.</span></li><li><b>We’ll help with fit</b><span>Your tailor confirms measurements, fabric and timing.</span></li><li><b>Approve your quote</b><span>We agree a price and plan before work begins.</span></li><li><b>Made with care</b><span>Our atelier keeps you updated through fitting.</span></li></ol><Link className="text-link" to="/customer-care">Questions first? Talk to us <ArrowRight size={14} /></Link></div>
          <div className="order-aside-ai"><Sparkles size={18} /><h3>Not sure what to choose?</h3><p>Our style guide can help you think through fabrics, silhouettes and details for your occasion.</p><Link to="/style-assistant">Get style inspiration <ArrowRight size={14} /></Link></div>
        </aside>
      </section>
    </>
  );
}

export function StyleAssistantPage() {
  const [occasion, setOccasion] = useState("");
  const [style, setStyle] = useState("");
  const [message, setMessage] = useState("");
  return (
    <>
      <PageIntro label="A little help from the atelier" title={<>Find a style<br /><em>that feels like you.</em></>} description="Tell us where you’re going and the kind of feeling you want. Our style advisor is being prepared to offer personal suggestions." />
      <section className="style-assistant-layout">
        <div className="style-form">
          <div className="ai-connection"><span className="connection-dot" /><div><b>AI style assistant</b><span>Waiting for provider setup</span></div><Sparkles size={17} /></div>
          <label>What are you dressing for?<select value={occasion} onChange={(event) => setOccasion(event.target.value)}><option value="">Choose an occasion</option><option>Wedding or celebration</option><option>Work or business</option><option>Everyday wear</option><option>Traditional event</option><option>Holiday or travel</option></select></label>
          <label>What should it feel like?<select value={style} onChange={(event) => setStyle(event.target.value)}><option value="">Choose a feeling</option><option>Relaxed and effortless</option><option>Elegant and graceful</option><option>Bold and expressive</option><option>Classic and understated</option><option>Comfortable and practical</option></select></label>
          <button className="button button-dark" disabled={!occasion || !style} onClick={() => setMessage("AI suggestions aren’t connected yet. You can still ask our atelier for personal recommendations.")}>Get my ideas <Sparkles size={15} /></button>
          {message && <p className="form-status" role="status">{message}</p>}
          <p className="privacy-note">AI styling is not connected yet, so your selections are not sent to an AI service.</p>
        </div>
        <div className="style-inspiration">
          <Eyebrow>Made for a starting point</Eyebrow>
          <h2>A few things<br /><em>we love.</em></h2>
          <div className="inspiration-item"><span>01</span><div><b>For celebrations</b><p>Consider breathable cotton or linen with one distinctive detail—an expressive sleeve, a sculpted neckline, or a beautiful wrap.</p></div></div>
          <div className="inspiration-item"><span>02</span><div><b>For everyday</b><p>Look for easy movement, a comfortable waist, and fabric that gets softer with wear. A co-ord can work hard as separates, too.</p></div></div>
          <div className="inspiration-item"><span>03</span><div><b>When you’re not sure</b><p>Bring us a reference image and tell us what you love about it. We’ll help find a fabric and shape that suits your day.</p></div></div>
          <span className="inspiration-disclaimer">Atelier inspiration · Not AI-generated</span>
          <Link className="text-link" to="/custom-tailoring">Take your idea to the atelier <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}

export function CarePage() {
  return (
    <>
      <PageIntro label="We’re here for you" title={<>A real person,<br /><em>a thoughtful answer.</em></>} description="Questions about a garment, a fitting or an order? Reach our Abuja atelier through WhatsApp customer care." />
      <section className="care-page">
        <div className="care-contact-card">
          <div className="care-contact-icon"><MessageCircle size={23} /></div>
          <Eyebrow>Customer care · WhatsApp</Eyebrow>
          <h2>Let’s talk it<br /><em>through.</em></h2>
          <p>Our team can help with custom requests, measurements, fabrics, existing orders and aftercare.</p>
          {whatsappNumber ? (
            <a className="button button-dark" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello 6Native Tailor, I need a little help.")}`} target="_blank" rel="noreferrer">Chat with customer care <ArrowUpRight size={16} /></a>
          ) : (
            <div className="integration-notice"><b>WhatsApp is not connected yet.</b><span>Add the official business number as <code>VITE_WHATSAPP_NUMBER</code> to enable chat.</span></div>
          )}
          <span className="care-hours">Abuja, Nigeria · Monday–Saturday</span>
        </div>
        <div className="care-topics"><Eyebrow>How can we help?</Eyebrow><h2>Here for the<br /><em>little details.</em></h2>
          <Link to="/custom-tailoring"><span>01</span><div><b>Start a custom order</b><small>Share your idea, measurements and references.</small></div><ArrowRight size={16} /></Link>
          <Link to="/fit-guide"><span>02</span><div><b>Measurement help</b><small>Learn how to measure with confidence.</small></div><ArrowRight size={16} /></Link>
          <Link to="/shipping-returns"><span>03</span><div><b>Delivery & returns</b><small>Read about our current policies.</small></div><ArrowRight size={16} /></Link>
          <Link to="/faq"><span>04</span><div><b>Common questions</b><small>Find quick answers from our atelier.</small></div><ArrowRight size={16} /></Link>
        </div>
      </section>
      <section className="care-note"><span>✳</span><p>Every custom piece is different. We’ll confirm timelines, prices and next steps with you before any work begins.</p></section>
    </>
  );
}

export function AtelierPage() {
  return (
    <>
      <PageIntro label="The people behind the pieces" title={<>Good things take<br /><em>good hands.</em></>} description="Our Abuja atelier brings generations of skill into a new conversation about what African fashion can be." />
      <section className="atelier-page">
        <div className="atelier-page-image"><img src="/images/black-native-tunic.jpeg" alt="Black traditional tunic with embroidered trim on a mannequin" /><span>NATIVE STYLES · MADE IN ABUJA</span></div>
        <div className="atelier-page-copy"><Eyebrow>The art of the almost-forgotten</Eyebrow><h2>Made with<br /><em>intention.</em></h2><p>Every piece begins with a person, a fabric, and the time to get it right. We value the hands and the decisions behind a garment as much as the finished piece.</p><p>From the first sketch to the final fitting, our team works with you to bring your ideas to life—carefully, collaboratively, and close to home.</p><Link className="button button-dark" to="/custom-tailoring">Make something with us <ArrowRight size={16} /></Link><div className="atelier-signature">Made with intention <span>✳</span> Worn with joy</div></div>
      </section>
      <section className="craft-values"><div><span>01</span><h3>Thoughtful by nature</h3><p>We choose quality, comfort and longevity over making more for the sake of it.</p></div><div><span>02</span><h3>Rooted in craft</h3><p>Our work honours the skill, creativity and point of view of African makers.</p></div><div><span>03</span><h3>Made together</h3><p>The best custom piece comes from listening closely and making decisions with you.</p></div></section>
    </>
  );
}

export function OurStoryPage() {
  return (
    <>
      <PageIntro label="6Native Tailor · Abuja, Nigeria" title={<>Crafted for<br /><em>your identity.</em></>} description="African fashion, made personal. We believe what you wear should tell your story, feel good to live in, and be made with care." />
      <section className="story-page">
        <div className="story-visual"><span className="story-mark">6N</span><span>09°04′N · 07°29′E · ABUJA</span></div>
        <div className="story-copy"><Eyebrow>Our point of view</Eyebrow><h2>Heritage is not<br />a look. It’s a <em>living thing.</em></h2><p>6Native Tailor is an Abuja fashion house built around the belief that African design is always moving—shaped by where we come from and where we’re going.</p><p>We make thoughtful pieces for the lives people lead now. Ready-to-wear collections and custom garments, brought together by craft, care and a clear point of view.</p><Link className="text-link" to="/atelier">Meet the hands behind our work <ArrowRight size={14} /></Link></div>
      </section>
      <div className="story-cta"><p>Wear the piece that feels like yours.</p><Link className="button button-dark" to="/shop">Explore 6Native <ArrowRight size={16} /></Link></div>
    </>
  );
}

export function FitGuidePage() {
  return (
    <>
      <PageIntro label="A little help from the atelier" title={<>Measure with<br /><em>confidence.</em></>} description="A flexible tape measure and a few minutes are all you need. If you’re unsure, leave it blank—our tailor can help you through it." />
      <section className="fit-guide">
        <div className="fit-guide-intro"><Ruler size={22} /><div><b>Before you begin</b><p>Wear light clothing, stand naturally, and keep the tape snug without pulling it tight. Ask someone to help with shoulder and length measurements.</p></div></div>
        <div className="fit-steps">{measurements.map(([, label, hint], index) => <article key={label}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{label}</h2><p>{hint}</p></div><div className="fit-illustration"><Ruler size={18} /></div></article>)}</div>
        <div className="fit-disclaimer"><b>A note on fit</b><p>Measurements are a helpful starting point, not a guarantee of garment fit. Our tailor will confirm what’s needed for your design before making begins.</p></div>
        <Link className="button button-dark" to="/custom-tailoring">Share measurements with us <ArrowRight size={16} /></Link>
      </section>
    </>
  );
}

const faqs = [
  ["How do I start a custom order?", "Tell us what you’re imagining on the custom tailoring page. You can share your garment idea, measurements, preferred fabric and a reference image. Our atelier will discuss the design and confirm a quote and timeline with you before work begins."],
  ["What if I don’t know my measurements?", "That’s completely fine. Use our measurement guide as a starting point, or contact customer care and our team can help you through it."],
  ["Can I send a photo of a design I like?", "Yes. You can preview up to three image references in the custom request form. When you continue to WhatsApp, attach the pictures in that chat so the atelier can see them."],
  ["How long does custom tailoring take?", "Timing depends on the garment, materials and current atelier schedule. We’ll confirm an estimated timeline with you before accepting the work."],
  ["How do I care for my garment?", "Care depends on the fabric and construction. Check the care label and ask our team if you’re unsure; we’ll be happy to advise on the individual piece."],
  ["Do you deliver outside Abuja?", "Delivery options and timing depend on your location. Contact customer care for current availability before placing a custom request."],
];

export function FaqPage() {
  return (
    <>
      <PageIntro label="A few helpful answers" title={<>Good to <em>know.</em></>} description="The useful details, all in one place. If you don’t see your question, our customer care team is happy to help." />
      <section className="faq-page">
        {faqs.map(([question, answer], index) => <details className="faq-item" key={question}><summary><span>{String(index + 1).padStart(2, "0")}</span><b>{question}</b><Plus size={17} /></summary><p>{answer}</p></details>)}
        <div className="faq-contact"><p>Still wondering about something?</p><Link className="text-link" to="/customer-care">Ask customer care <ArrowRight size={15} /></Link></div>
      </section>
    </>
  );
}

export function ShippingPage() {
  return (
    <>
      <PageIntro label="The practical details" title={<>Delivery, with<br /><em>care.</em></>} description="We’ll confirm the details for your particular order before it ships. Here’s what to expect from our team." />
      <section className="policy-page">
        <article><span>01</span><div><h2>Delivery options</h2><p>Delivery availability, fees and estimated timing depend on your location and the type of order. Our team confirms the options before you place or approve an order.</p></div></article>
        <article><span>02</span><div><h2>Ready-to-wear pieces</h2><p>For stocked items, we’ll share the expected dispatch window and delivery details when checkout is available. If you have a timing question, ask customer care before ordering.</p></div></article>
        <article><span>03</span><div><h2>Custom garments</h2><p>Custom orders need time for design, fitting and finishing. The atelier agrees an estimated schedule with you before work begins; changes to a design can affect timing.</p></div></article>
        <article><span>04</span><div><h2>Returns and alterations</h2><p>Return eligibility and alteration options depend on whether a piece is ready-to-wear or made to your specifications. Contact us promptly if something isn’t right; we’ll discuss the next steps with you.</p></div></article>
        <div className="policy-note"><b>Please note</b><p>These are general guidelines, not a complete store policy. Final delivery, payment and return terms will be shared before checkout is enabled.</p></div>
        <Link className="text-link" to="/customer-care">Ask us about an order <ArrowRight size={15} /></Link>
      </section>
    </>
  );
}

export function NotFoundPage() {
  return <section className="not-found"><Eyebrow>A little detour</Eyebrow><h1>This page isn’t<br /><em>stitched yet.</em></h1><p>Let’s take you back to the atelier.</p><Link className="button button-dark" to="/">Return home <ArrowRight size={16} /></Link></section>;
}
