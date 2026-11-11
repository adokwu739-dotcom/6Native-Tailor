import { useEffect, useRef, useState, type FormEvent, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Ruler,
  Scissors,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { PoseLandmarker, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { formatNaira, products, type Product } from "./catalog";
import { imageForSlot, useManagedMedia } from "./media";

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
const capMeasurements = [
  ["headCircumference", "Head circumference", "Wrap the tape around your head above the eyebrows and ears; keep it comfortably snug."],
] as const;
type FitProfile = "women" | "men" | "neutral";
const selfMeasurementProfiles: Record<FitProfile, { key: string; label: string; hint: string }[]> = {
  women: [
    { key: "bust", label: "Bust", hint: "Wrap the tape around the fullest part of your bust, keeping it level." },
    { key: "waist", label: "Natural waist", hint: "Measure the narrowest part of your waist without holding your breath." },
    { key: "hip", label: "Full hip", hint: "Measure around the fullest part of your hips and seat." },
    { key: "shoulder", label: "Shoulder width", hint: "Measure from one shoulder edge to the other across your back." },
    { key: "sleeve", label: "Sleeve length", hint: "Measure from the shoulder edge to your wrist with your arm slightly bent." },
    { key: "dressLength", label: "Dress length", hint: "Measure from the shoulder to your desired hem." },
  ],
  men: [
    { key: "bust", label: "Chest", hint: "Wrap the tape around the fullest part of your chest, under your arms." },
    { key: "waist", label: "Natural waist", hint: "Measure where you normally wear your trousers." },
    { key: "hip", label: "Seat", hint: "Measure around the fullest part of your seat." },
    { key: "shoulder", label: "Shoulder width", hint: "Measure from one shoulder edge to the other across your back." },
    { key: "sleeve", label: "Sleeve length", hint: "Measure from the shoulder edge to your wrist with your arm slightly bent." },
    { key: "topLength", label: "Shirt / kaftan length", hint: "Measure from the base of your neck to your preferred hem." },
    { key: "trouserLength", label: "Trouser length", hint: "Measure from your waistband to your desired ankle hem." },
  ],
  neutral: [
    { key: "bust", label: "Chest / bust", hint: "Wrap the tape around the fullest part of your chest or bust, keeping it level." },
    { key: "waist", label: "Natural waist", hint: "Measure around your natural waist, keeping the tape comfortably snug." },
    { key: "hip", label: "Full hip / seat", hint: "Measure around the fullest part of your hips and seat." },
    { key: "shoulder", label: "Shoulder width", hint: "Measure from one shoulder edge to the other across your back." },
    { key: "sleeve", label: "Sleeve length", hint: "Measure from the shoulder edge to your wrist with your arm slightly bent." },
    { key: "topLength", label: "Top length", hint: "Measure from the shoulder to your desired hem." },
    { key: "trouserLength", label: "Trouser length", hint: "Measure from your waistband to your desired ankle hem." },
  ],
};

type SmartFitFrame = {
  scaleCmPerPixel: number;
  chestWidthPx: number;
  waistWidthPx: number;
  hipWidthPx: number;
  shoulderWidthPx: number;
  sleeveLengthPx: number;
  topLengthPx: number;
  trouserLengthPx: number;
  dressLengthPx: number;
};

function analyzeSmartFitFrame(result: PoseLandmarkerResult, heightCm: number): SmartFitFrame | null {
  try {
    const landmarks = result.landmarks[0];
    const mask = result.segmentationMasks?.[0];
    if (!landmarks || !mask || mask.width < 2 || mask.height < 2) return null;
    if ([11, 12, 13, 14, 15, 16, 23, 24, 27, 28].some((index) => !landmarks[index] || (landmarks[index].visibility ?? 0) < 0.45)) return null;

    const width = mask.width;
    const height = mask.height;
    const data = mask.getAsFloat32Array();
    const threshold = 0.45;
    let top = height;
    let bottom = 0;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (data[y * width + x] > threshold) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }

    const bodyHeightPx = bottom - top;
    if (bodyHeightPx < height * 0.45 || top < height * 0.015 || bottom > height * 0.985) return null;

    const point = (index: number) => ({
      x: landmarks[index].x * width,
      y: landmarks[index].y * height,
    });
    const shoulderLeft = point(11);
    const shoulderRight = point(12);
    const hipLeft = point(23);
    const hipRight = point(24);
    const ankleLeft = point(27);
    const ankleRight = point(28);
    const shoulderCenter = { x: (shoulderLeft.x + shoulderRight.x) / 2, y: (shoulderLeft.y + shoulderRight.y) / 2 };
    const hipCenter = { x: (hipLeft.x + hipRight.x) / 2, y: (hipLeft.y + hipRight.y) / 2 };
    const ankleCenter = { x: (ankleLeft.x + ankleRight.x) / 2, y: (ankleLeft.y + ankleRight.y) / 2 };
    if (hipCenter.y <= shoulderCenter.y || ankleCenter.y <= hipCenter.y) return null;

    function torsoWidthAt(fraction: number) {
      const y = Math.max(0, Math.min(height - 1, Math.round(shoulderCenter.y + (hipCenter.y - shoulderCenter.y) * fraction)));
      const centerX = Math.max(0, Math.min(width - 1, Math.round(shoulderCenter.x + (hipCenter.x - shoulderCenter.x) * fraction)));
      const isPerson = (x: number) => data[y * width + x] > threshold;
      let seed = -1;
      const searchRadius = Math.max(3, Math.round(width * 0.08));
      for (let offset = 0; offset <= searchRadius && seed < 0; offset += 1) {
        if (centerX - offset >= 0 && isPerson(centerX - offset)) seed = centerX - offset;
        else if (centerX + offset < width && isPerson(centerX + offset)) seed = centerX + offset;
      }
      if (seed < 0) return 0;
      let left = seed;
      let right = seed;
      while (left > 0 && isPerson(left - 1)) left -= 1;
      while (right < width - 1 && isPerson(right + 1)) right += 1;
      return right - left + 1;
    }

    const pixelDistance = (first: { x: number; y: number }, second: { x: number; y: number }) =>
      Math.hypot(first.x - second.x, first.y - second.y);
    const wristLeft = point(15);
    const wristRight = point(16);
    const elbowLeft = point(13);
    const elbowRight = point(14);
    const shoulderWidthPx = pixelDistance(shoulderLeft, shoulderRight);
    const sleeveLengthPx = (
      pixelDistance(shoulderLeft, elbowLeft) + pixelDistance(elbowLeft, wristLeft) +
      pixelDistance(shoulderRight, elbowRight) + pixelDistance(elbowRight, wristRight)
    ) / 2;
    const scaleCmPerPixel = heightCm / bodyHeightPx;
    const measurementsAt = [0.32, 0.72, 1] as const;
    const widths = measurementsAt.map(torsoWidthAt);
    if (widths.some((value) => value < width * 0.035)) return null;

    return {
      scaleCmPerPixel,
      chestWidthPx: widths[0],
      waistWidthPx: widths[1],
      hipWidthPx: widths[2],
      shoulderWidthPx,
      sleeveLengthPx,
      topLengthPx: pixelDistance(shoulderCenter, hipCenter),
      trouserLengthPx: pixelDistance(hipCenter, ankleCenter),
      dressLengthPx: pixelDistance(shoulderCenter, ankleCenter),
    };
  } finally {
    result.close();
  }
}

function estimateSmartFitMeasurements(front: SmartFitFrame, side: SmartFitFrame) {
  function circumference(frontWidth: number, sideWidth: number) {
    const a = frontWidth * front.scaleCmPerPixel / 2;
    const b = sideWidth * side.scaleCmPerPixel / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  const toOneDecimal = (value: number) => (Math.round(value * 10) / 10).toString();
  return {
    bust: toOneDecimal(circumference(front.chestWidthPx, side.chestWidthPx)),
    waist: toOneDecimal(circumference(front.waistWidthPx, side.waistWidthPx)),
    hip: toOneDecimal(circumference(front.hipWidthPx, side.hipWidthPx)),
    shoulder: toOneDecimal(front.shoulderWidthPx * front.scaleCmPerPixel),
    sleeve: toOneDecimal(front.sleeveLengthPx * front.scaleCmPerPixel),
    topLength: toOneDecimal(front.topLengthPx * front.scaleCmPerPixel),
    trouserLength: toOneDecimal(front.trouserLengthPx * front.scaleCmPerPixel),
    dressLength: toOneDecimal(front.dressLengthPx * front.scaleCmPerPixel),
  };
}

type StyleSuggestions = {
  silhouette: string;
  details: string;
  fabric: string;
  fabricReason: string;
};

function createStyleSuggestions(occasion: string, garment: string, mood: string, climate: string): StyleSuggestions {
  const occasionAdvice: Record<string, { fabric: string; reason: string }> = {
    celebration: { fabric: "Printed Ankara cotton or cotton jacquard", reason: "both hold a defined shape and bring pattern or texture to a special look." },
    work: { fabric: "Mid-weight cotton or a linen blend", reason: "these feel polished while staying breathable through a long day." },
    everyday: { fabric: "Cotton poplin or soft Ankara cotton", reason: "these are easy to wear, care for, and style more than one way." },
    traditional: { fabric: "Ankara cotton, brocade, or lightweight jacquard", reason: "the structure and surface detail work beautifully for traditional tailoring." },
    travel: { fabric: "Lightweight cotton or a linen blend", reason: "these pack easily and feel comfortable when you are on the move." },
  };
  const fabricAdvice = occasionAdvice[occasion] ?? occasionAdvice.everyday;
  const comfortNote = climate === "warm"
    ? "For warm weather, ask the atelier for a lighter weight and a breathable lining."
    : climate === "cool"
      ? "For a cooler setting, consider a slightly heavier weave or a light layer."
      : "Ask the atelier to match the fabric weight to the season and how long you’ll wear it.";

  return {
    silhouette: `${mood} ${garment.toLowerCase()}`,
    details: occasion === "celebration"
      ? "Try a sculpted neckline or expressive sleeve, with one standout detail rather than competing embellishments."
      : occasion === "work"
        ? "Keep the lines clean and the finish considered; add a subtle contrast cuff or covered buttons for character."
        : "Choose relaxed proportions and one personal detail, such as a contrast facing, an easy sleeve, or a wrap finish.",
    fabric: fabricAdvice.fabric,
    fabricReason: `A thoughtful starting point because ${fabricAdvice.reason} ${comfortNote}`,
  };
}

const heroSlides = [
  {
    image: "/images/teal-ankara-dress.jpeg",
    alt: "Teal and gold Ankara dress displayed on a mannequin",
    caption: "THE EVERYDAY HEIRLOOMS EDIT",
  },
  {
    image: "/images/purple-agbada.jpeg",
    alt: "Purple agbada, a tailored Nigerian traditional outfit",
    caption: "TRADITION, TAILORED FOR TODAY",
  },
  {
    image: "/images/green-mens-kaftan.jpeg",
    alt: "Green men's kaftan with a refined native-wear silhouette",
    caption: "MADE WITH MEANING IN ABUJA",
  },
];

const galleryItems = [
  { image: "/images/all-season-ankara-dress.jpeg", alt: "All-season Ankara dress", type: "Dresses" },
  { image: "/images/teal-ankara-dress.jpeg", alt: "Teal and gold Ankara dress", type: "Dresses" },
  { image: "/images/green-palm-coord.jpeg", alt: "Green palm-print coordinated set", type: "Two-piece sets" },
  { image: "/images/purple-agbada.jpeg", alt: "Purple agbada set", type: "Traditional wear" },
  { image: "/images/green-mens-kaftan.jpeg", alt: "Green men's kaftan", type: "Men's native wear" },
  { image: "/images/black-native-tunic.jpeg", alt: "Black native tunic with embroidered trim", type: "Men's native wear" },
];

const piecesToKeep = [
  { image: "/images/striped-wrap-dress.jpeg", alt: "Black and white striped wrap dress", name: "Striped wrap dress", type: "Dresses" },
  { image: "/images/blue-floral-dress.jpeg", alt: "White dress with a blue floral print", name: "Blue floral dress", type: "Dresses" },
  { image: "/images/look-03.avif", alt: "New outfit look supplied by 6Native Tailor", name: "A new look", type: "Ready to wear" },
  { image: "/images/africa-print-coord.jpeg", alt: "Cream shirt with an Africa print and matching trousers", name: "Africa print co-ord", type: "Two-piece sets" },
  { image: "/images/embroidered-panel-jacket.jpeg", alt: "Cream jacket with embroidered fabric panels", name: "Embroidered panel jacket", type: "Jackets" },
  { image: "/images/green-embroidered-tunic.jpeg", alt: "Dark green tunic with tonal embroidery", name: "Green embroidered tunic", type: "Native wear" },
  { image: "/images/burgundy-printed-coord.jpeg", alt: "Burgundy, white and green printed matching set", name: "Burgundy printed set", type: "Two-piece sets" },
  { image: "/images/burgundy-set.jpeg", alt: "Burgundy patterned top with matching trousers", name: "Burgundy patterned co-ord", type: "Two-piece sets" },
];

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
  const [activeSlide, setActiveSlide] = useState(0);
  const media = useManagedMedia();
  const managedGallery = media.filter((asset) => asset.slot === "homepage-gallery");
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  function moveSlide(direction: number) {
    setActiveSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  return (
    <>
      <section className="hero" aria-roledescription="carousel" aria-label="Featured 6Native Tailor looks">
        {heroSlides.map((slide, index) => (
          <img
            key={slide.image}
            className={`hero-image ${index === activeSlide ? "is-active" : ""}`}
            src={imageForSlot(media, `hero-${index + 1}`, slide.image)}
            alt={index === activeSlide ? slide.alt : ""}
            aria-hidden={index !== activeSlide}
          />
        ))}
        <div className="hero-overlay" />
        <div className="hero-copy">
          <Eyebrow>Made with meaning, worn with ease</Eyebrow>
          <h1>Rooted in<br />where we’re <em>going.</em></h1>
          <p className="hero-description">Thoughtful African design, made slowly and beautifully for the way you live now.</p>
          <Link className="button button-light" to="/pieces-to-keep">Explore the collection <ArrowRight size={16} /></Link>
        </div>
        <div className="hero-caption">{heroSlides[activeSlide].caption}</div>
        <div className="hero-controls" aria-label="Slideshow controls">
          <button type="button" className="hero-control-button" onClick={() => moveSlide(-1)} aria-label="Previous slide"><ChevronLeft size={17} /></button>
          <span className="hero-dots">
            {heroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.image}
                className={`hero-dot ${index === activeSlide ? "is-active" : ""}`}
                onClick={() => setActiveSlide(index)}
                aria-label={`Show slide ${index + 1}: ${slide.caption.toLowerCase()}`}
                aria-current={index === activeSlide ? "true" : undefined}
              />
            ))}
          </span>
        </div>
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
          <Link to="/custom-tailoring" className="service-card service-custom"><span className="service-number">01 / BESPOKE</span><h3>Made just<br /><em>for you.</em></h3><p>Custom garments shaped around your style, fit and occasion.</p><b className="service-price">Minimum order ₦50,000</b><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
          <Link to="/custom-tailoring" className="service-card service-shop"><span className="service-number">02 / ALTERATIONS</span><h3>A better<br /><em>fit.</em></h3><p>Bring us the garment and we’ll assess what can be adjusted.</p><b className="service-price">Quote after assessment</b><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
          <Link to="/custom-tailoring" className="service-card service-style"><span className="service-number">03 / REPAIRS</span><h3>Wear it<br /><em>longer.</em></h3><p>Repair options and costs depend on the fabric and work needed.</p><b className="service-price">Quote after assessment</b><span className="service-arrow"><ArrowUpRight size={19} /></span></Link>
        </div>
        <Link className="text-link mobile-link" to="/custom-tailoring">Ask about a service <ArrowRight size={15} /></Link>
      </section>

      <section className="home-gallery section-pad">
        <div className="section-heading">
          <div><Eyebrow>Selected finished pieces</Eyebrow><h2>Made in <em>Abuja.</em></h2></div>
          <Link className="text-link desktop-link" to="/atelier">See our atelier <ArrowRight size={15} /></Link>
        </div>
        <div className="gallery-grid">
          {galleryItems.map((item) => (
            <figure className="gallery-item" key={item.image}>
              <img src={imageForSlot(media, `product-${products.find((product) => product.image === item.image)?.id ?? ""}`, item.image)} alt={item.alt} loading="lazy" />
              <figcaption><span>{item.type}</span><b>{item.alt}</b></figcaption>
            </figure>
          ))}
          {managedGallery.map((asset) => (
            <figure className="gallery-item" key={asset.id}>
              <img src={asset.url} alt={asset.alt} loading="lazy" />
              <figcaption><span>From the atelier</span><b>{asset.alt}</b></figcaption>
            </figure>
          ))}
        </div>
        <p className="gallery-note">These are finished looks; before-and-after alteration photos will be added when available.</p>
      </section>

      <section className="home-featured section-pad">
        <div className="section-heading">
          <div><Eyebrow>Thoughtfully made in Abuja</Eyebrow><h2>Pieces to <em>keep.</em></h2></div>
          <Link className="text-link desktop-link" to="/pieces-to-keep">Shop the collection <ArrowRight size={15} /></Link>
        </div>
        <div className="product-grid">
          {products.slice(0, 3).map((product) => <ProductTile key={product.id} product={product} image={imageForSlot(media, `product-${product.id}`, product.image)} addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />)}
        </div>
        <Link className="text-link mobile-link" to="/pieces-to-keep">Shop the collection <ArrowRight size={15} /></Link>
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

function ProductTile({ product, image = product.image, addToBag, saved, toggleSaved }: {
  product: Product;
  image?: string;
  addToBag?: (product: Product) => void;
  saved?: string[];
  toggleSaved?: (id: string) => void;
}) {
  const isSaved = saved?.includes(product.id) ?? false;
  return (
    <article className="product-card">
      <div className="product-image-wrap" style={{ backgroundColor: product.color }}>
        <img src={image} alt={product.name} loading="lazy" />
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
  const media = useManagedMedia();
  const managedGallery = media.filter((asset) => asset.slot === "pieces-gallery");
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
          {visible.map((product) => <ProductTile key={product.id} product={product} image={imageForSlot(media, `product-${product.id}`, product.image)} addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />)}
        </div>
        <section className="pieces-gallery" aria-labelledby="pieces-gallery-title">
          <div className="section-heading">
            <div><Eyebrow>More from the atelier</Eyebrow><h2 id="pieces-gallery-title">New looks to <em>keep.</em></h2></div>
          </div>
          <div className="pieces-gallery-grid">
            {piecesToKeep.map((piece) => (
              <article className="pieces-gallery-card" key={piece.image}>
                <img src={piece.image} alt={piece.alt} loading="lazy" />
                <div><span>{piece.type}</span><h3>{piece.name}</h3><Link to="/custom-tailoring">Ask about this look <ArrowRight size={13} /></Link></div>
              </article>
            ))}
            {managedGallery.map((asset) => (
              <article className="pieces-gallery-card" key={asset.id}>
                <img src={asset.url} alt={asset.alt} loading="lazy" />
                <div><span>From the atelier</span><h3>{asset.alt}</h3><Link to="/custom-tailoring">Ask about this look <ArrowRight size={13} /></Link></div>
              </article>
            ))}
          </div>
          <p className="gallery-note">Contact the atelier for availability and pricing for these looks.</p>
        </section>
        <div className="shop-tailoring-note"><Scissors size={19} /><p>Looking for something made around you?</p><Link className="text-link" to="/custom-tailoring">Explore custom tailoring <ArrowRight size={15} /></Link></div>
      </section>
    </>
  );
}

type OrderForm = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  garment: string;
  occasion: string;
  fabric: string;
  deadline: string;
  unit: string;
  notes: string;
  [key: string]: string;
};

const initialOrder: OrderForm = {
  name: "", email: "", phone: "", gender: "", garment: "Dress", occasion: "", fabric: "", deadline: "", unit: "cm", notes: "",
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

  useEffect(() => {
    const saved = window.sessionStorage.getItem("6native-self-measurements");
    if (!saved) return;
    try {
      const profile = JSON.parse(saved) as { gender?: string; unit?: string; values?: Record<string, string> };
      const savedValues = profile.values;
      if (savedValues && typeof savedValues === "object") {
        setForm((current) => ({
          ...current,
          gender: profile.gender ?? current.gender,
          unit: profile.unit === "in" ? "in" : "cm",
          ...Object.fromEntries(Object.entries(savedValues).filter(([, value]) => typeof value === "string")),
        }));
        setFormMessage("Your self-measurements have been added to this form. Please check them before sharing.");
      }
    } catch {
      setFormMessage("We couldn’t read the saved measurement set. Please enter your measurements here.");
    } finally {
      window.sessionStorage.removeItem("6native-self-measurements");
    }
  }, []);

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
    const selectedMeasurements = form.garment === "Cap" ? capMeasurements : measurements;
    const dimensions = selectedMeasurements
      .map(([key, defaultLabel]) => {
        const label = form.gender === "men" && key === "bust" ? "Chest" : form.gender === "men" && key === "hip" ? "Seat" : form.gender === "neutral" && key === "bust" ? "Chest / bust" : defaultLabel;
        return form[key] ? `${label}: ${form[key]} ${form.unit}` : "";
      })
      .filter(Boolean)
      .join("\n");
    const text = [
      "Hello 6Native Tailor, I would like to discuss a custom garment.",
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone || "Not provided"}`,
      `Fit profile: ${form.gender || "Not specified"}`,
      `Garment: ${form.garment}`,
      `Occasion: ${form.occasion || "Not specified"}`,
      `Needed by: ${form.deadline || "Flexible / to be discussed"}`,
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
              <label>Fit profile <span className="optional">Optional</span><select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Choose if you’d like</option><option value="women">Women’s fit</option><option value="men">Men’s fit</option><option value="neutral">Gender-neutral fit</option></select></label>
              <label>What are we making?<select value={form.garment} onChange={(event) => update("garment", event.target.value)}><option>Dress</option><option>Two-piece set</option><option>Shirt or top</option><option>Trousers or skirt</option><option>Traditional wear</option><option>Cap</option><option>Something else</option></select></label>
              <label>Occasion <span className="optional">Optional</span><input value={form.occasion} onChange={(event) => update("occasion", event.target.value)} placeholder="A wedding, everyday, a date…" /></label>
              <label>When do you need it by? <span className="optional">Optional</span><input type="date" value={form.deadline} onChange={(event) => update("deadline", event.target.value)} /></label>
              <label>Fabric or colour ideas <span className="optional">Optional</span><input value={form.fabric} onChange={(event) => update("fabric", event.target.value)} placeholder="Or ask us for suggestions" /></label>
            </div>
          </div>

          <div className="form-section">
            <div className="form-heading"><span>02</span><div><h2>Your measurements.</h2><p>Share what you know; our tailor can guide you through the rest.</p></div></div>
            <label className="unit-picker">Measurement unit<select value={form.unit} onChange={(event) => update("unit", event.target.value)}><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></label>
            <div className="measurement-grid">
              {(form.garment === "Cap" ? capMeasurements : measurements).map(([key, defaultLabel, hint]) => {
                const label = form.gender === "men" && key === "bust" ? "Chest" : form.gender === "men" && key === "hip" ? "Seat" : form.gender === "neutral" && key === "bust" ? "Chest / bust" : defaultLabel;
                return (
                <label key={key} title={hint}>{label}<div className="measurement-input"><input type="number" min="0" max="300" step="0.1" value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} placeholder="—" /><span>{form.unit}</span></div></label>
                );
              })}
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
  const [garment, setGarment] = useState("");
  const [mood, setMood] = useState("");
  const [climate, setClimate] = useState("");
  const [suggestions, setSuggestions] = useState<StyleSuggestions | null>(null);
  return (
    <>
      <PageIntro label="A little help from the atelier" title={<>Find a style<br /><em>that feels like you.</em></>} description="Build a design brief and get a thoughtful outfit direction, plus fabric ideas shaped around your occasion and how you want to feel." />
      <section className="style-assistant-layout">
        <div className="style-form">
          <div className="ai-connection"><span className="connection-dot" /><div><b>AI outfit design assistant</b><span>Personalized preview · AI provider not connected</span></div><Sparkles size={17} /></div>
          <label>What are you dressing for?<select value={occasion} onChange={(event) => { setOccasion(event.target.value); setSuggestions(null); }}><option value="">Choose an occasion</option><option value="celebration">Wedding or celebration</option><option value="work">Work or business</option><option value="everyday">Everyday wear</option><option value="traditional">Traditional event</option><option value="travel">Holiday or travel</option></select></label>
          <label>What would you like made?<select value={garment} onChange={(event) => { setGarment(event.target.value); setSuggestions(null); }}><option value="">Choose a garment</option><option>Dress</option><option>Kaftan</option><option>Two-piece set</option><option>Shirt and trousers</option><option>Jacket</option><option>Skirt and top</option></select></label>
          <label>What should it feel like?<select value={mood} onChange={(event) => { setMood(event.target.value); setSuggestions(null); }}><option value="">Choose a feeling</option><option>Relaxed and effortless</option><option>Elegant and graceful</option><option>Bold and expressive</option><option>Classic and understated</option><option>Comfortable and practical</option></select></label>
          <label>Where will you wear it?<select value={climate} onChange={(event) => { setClimate(event.target.value); setSuggestions(null); }}><option value="">Choose your setting</option><option value="warm">Warm weather / outdoors</option><option value="cool">Cool evening / indoor setting</option><option value="mixed">A little of both</option></select></label>
          <button className="button button-dark" disabled={!occasion || !garment || !mood || !climate} onClick={() => setSuggestions(createStyleSuggestions(occasion, garment, mood, climate))}>Create my design brief <Sparkles size={15} /></button>
          {suggestions && (
            <div className="style-result" role="status" aria-live="polite">
              <Eyebrow>Your design starting point</Eyebrow>
              <h3>{suggestions.silhouette}</h3>
              <p>{suggestions.details}</p>
              <div className="fabric-recommendation"><span>SMART FABRIC PICK</span><b>{suggestions.fabric}</b><p>{suggestions.fabricReason}</p></div>
              <Link className="text-link" to="/custom-tailoring">Take this brief to the atelier <ArrowRight size={14} /></Link>
            </div>
          )}
          <p className="privacy-note">This interactive preview uses your selections in this browser; it is not AI-generated or sent to an AI service. A connected AI provider is needed for generative design advice.</p>
        </div>
        <div className="style-inspiration">
          <Eyebrow>Smart fabric recommendation</Eyebrow>
          <h2>Start with<br /><em>how it feels.</em></h2>
          <div className="inspiration-item"><span>01</span><div><b>For celebrations</b><p>Printed Ankara cotton and cotton jacquard bring colour or texture while holding a beautifully defined shape.</p></div></div>
          <div className="inspiration-item"><span>02</span><div><b>For everyday</b><p>Breathable cotton poplin and easy linen blends make comfortable pieces that work hard as separates.</p></div></div>
          <div className="inspiration-item"><span>03</span><div><b>Choose for your setting</b><p>Fabric weight, lining and finish all affect comfort. Our atelier will confirm current options and availability before you order.</p></div></div>
          <span className="inspiration-disclaimer">Curated fabric guidance · final selection confirmed by the atelier</span>
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
      <PageIntro label="About us · 6Native Tailor" title={<>Our culture.<br /><em>Our style. Your story.</em></>} description="At 6Native Tailor, we believe what you wear should say something about who you are." />
      <section className="story-page">
        <div className="story-visual"><span className="story-mark">6N</span><span>09°04′N · 07°29′E · ABUJA</span></div>
        <div className="story-copy">
          <Eyebrow>Our point of view</Eyebrow>
          <h2>Our journey,<br />rooted in <em>identity.</em></h2>
          <p>Our journey began with a passion for fashion, a love for African culture, and a desire to create clothes that make people feel confident, comfortable, and proud of their identity.</p>
          <p>For us, tailoring is more than cutting and sewing fabrics. It’s about understanding people, their personalities, their taste, and the little details that make them unique.</p>
          <p>We bring traditional craftsmanship and modern styles together to create outfits that feel personal. Whether it’s something simple for everyday wear or a special design for a memorable occasion, we put care and creativity into every piece.</p>
          <p>At 6Native Tailor, we don’t just want to make clothes that look good. We want to create outfits you’ll feel good wearing, clothes that tell your story and reflect your roots.</p>
          <p className="story-quote"><strong>Because at the end of the day, fashion isn’t just about what you wear. It’s about how you feel when you wear it.</strong></p>
          <p className="story-signature"><strong>6Native Tailor — Crafted for Your Identity.</strong></p>
          <Link className="text-link" to="/atelier">Meet the hands behind our work <ArrowRight size={14} /></Link>
        </div>
      </section>
      <div className="story-cta"><p>Wear the piece that feels like yours.</p><Link className="button button-dark" to="/pieces-to-keep">Explore 6Native <ArrowRight size={16} /></Link></div>
    </>
  );
}

function SmartFitCamera({ profile, heightCm, onMeasurements }: {
  profile: FitProfile | "";
  heightCm: number;
  onMeasurements: (measurements: Record<string, string>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frontFrameRef = useRef<SmartFitFrame | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState<"front" | "side">("front");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [cameraAspectRatio, setCameraAspectRatio] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const cameraMaxHeight = Math.min(viewportHeight * 0.65, 420);
  const cameraPreviewWidth = cameraAspectRatio ? Math.min(420, cameraMaxHeight * cameraAspectRatio) : undefined;

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    if (!profile) {
      setError("Choose a fit profile before starting SmartFit.");
      return;
    }
    if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 230) {
      setError("Enter your height between 120 and 230 cm (about 4′0″–7′7″) for calibration.");
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires a supported browser on HTTPS or localhost. You can enter measurements manually below.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);
    if (complete) onMeasurements({});
    setComplete(false);
    setView("front");
    frontFrameRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("The camera preview could not be opened.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        setCameraAspectRatio(videoRef.current.videoWidth / videoRef.current.videoHeight);
      }

      if (!landmarkerRef.current) {
        const { FilesetResolver, PoseLandmarker: MediaPipePoseLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
        landmarkerRef.current = await MediaPipePoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task` },
          runningMode: "IMAGE",
          numPoses: 1,
          outputSegmentationMasks: true,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
        });
      }
      setCameraActive(true);
      setMessage("Camera is ready. Center your full body in the guide, then capture the front view.");
    } catch (cameraError) {
      stopCamera();
      setError(cameraError instanceof Error ? `SmartFit could not start: ${cameraError.message}` : "SmartFit could not start. Check camera permission and try again.");
    } finally {
      setLoading(false);
    }
  }

  function captureView() {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("The camera is not ready yet. Wait for the preview and try again.");
      return;
    }

    setError("");
    setProcessing(true);
    try {
      const frame = analyzeSmartFitFrame(landmarker.detect(video), heightCm);
      if (!frame) {
        setError("We couldn’t read a clear full-body view. Keep your head and feet in frame, face the camera, and make sure the room is well lit.");
        return;
      }

      if (view === "front") {
        frontFrameRef.current = frame;
        setView("side");
        setMessage("Front view captured. Turn sideways without changing your distance from the phone, then capture the side view.");
        return;
      }

      if (!frontFrameRef.current) {
        setError("The front view is missing. Please restart the measurement.");
        return;
      }

      const estimatesInCm = estimateSmartFitMeasurements(frontFrameRef.current, frame);
      onMeasurements(estimatesInCm);
      setComplete(true);
      setMessage("Both views are analyzed. Review and adjust the estimated measurements below before saving or sharing.");
      stopCamera();
    } catch (captureError) {
      setError(captureError instanceof Error ? `Could not analyze this view: ${captureError.message}` : "Could not analyze this view. Try capturing again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="smartfit-camera">
      <div className="smartfit-camera-heading"><div><Eyebrow>CAMERA-GUIDED MEASUREMENT</Eyebrow><h3>SmartFit <span>· on-device estimate</span></h3></div><span className="smartfit-privacy-badge">Private by design</span></div>
      <p className="smartfit-intro">Allow camera access, follow the positioning guide, and take a front and side view. Pose landmarks and body outline are analyzed on this device; no images or video are uploaded or saved.</p>
      <ol className="smartfit-view-steps">
        <li className={view === "front" ? "is-current" : frontFrameRef.current ? "is-done" : ""}><span>01</span>Front view</li>
        <li className={view === "side" ? "is-current" : complete ? "is-done" : ""}><span>02</span>Side view</li>
        <li className={complete ? "is-done" : ""}><span>03</span>Review estimates</li>
      </ol>
      <div className={`smartfit-camera-stage ${cameraActive ? "is-active" : ""}`} style={cameraPreviewWidth ? { aspectRatio: cameraAspectRatio ?? undefined, width: `min(100%, ${cameraPreviewWidth}px)`, maxHeight: `${cameraMaxHeight}px` } : undefined}>
        <video ref={videoRef} className="smartfit-video" autoPlay muted playsInline aria-label="Live camera preview for SmartFit" aria-hidden={!cameraActive} />
        {cameraActive ? (
          <div className="smartfit-guide-overlay" aria-hidden="true"><span className="smartfit-guide-frame" /><span className="smartfit-guide-line" /><small>{view === "front" ? "FACE FORWARD · ARMS SLIGHTLY OUT" : "TURN 90° · KEEP FEET IN FRAME"}</small></div>
        ) : (
          <div className="smartfit-camera-placeholder"><Ruler size={25} /><b>{complete ? "Your camera is off" : "Camera preview will appear here"}</b><span>Position your phone vertically, around 2–3 m away.</span></div>
        )}
      </div>
      <div className="smartfit-positioning">
        <b>{view === "front" ? "Front view" : "Side view"}</b>
        <p>Place your phone on a stable surface at waist height. Stand in fitted clothing against a clear background, keep your feet visible, and use even lighting. Keep the same distance and footing for both views.</p>
      </div>
      {message && <p className="form-status" role="status">{message}</p>}
      {error && <p className="form-status smartfit-error" role="alert">{error}</p>}
      <div className="smartfit-camera-actions">
        {cameraActive ? (
          <>
            <button type="button" className="button button-dark" onClick={captureView} disabled={processing}>{processing ? "Analyzing view…" : `Capture ${view} view`} <ArrowRight size={15} /></button>
            <button type="button" className="text-link" onClick={stopCamera}>Stop camera</button>
          </>
        ) : (
          <button type="button" className="button button-dark" onClick={startCamera} disabled={loading || !profile || !heightCm}>{loading ? "Preparing camera and body landmark model…" : complete ? "Retake both views" : "Allow camera & start SmartFit"} <ArrowRight size={15} /></button>
        )}
      </div>
      <p className="smartfit-caveat">These are approximate estimates based on your stated height and two camera views—not professional measurements or a fit guarantee. The tailor should verify them before making your garment.</p>
    </div>
  );
}

function isFitProfile(value: unknown): value is FitProfile {
  return value === "women" || value === "men" || value === "neutral";
}

export function FitGuidePage() {
  const [profile, setProfile] = useState<FitProfile | "">("");
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [height, setHeight] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const profileFields = profile ? selfMeasurementProfiles[profile] : [];
  const completedCount = profileFields.filter(({ key }) => values[key]?.trim()).length;
  const heightInCm = Number(height) * (unit === "in" ? 2.54 : 1);
  const fieldsToShow = profileFields.length ? profileFields : measurements.map(([key, label, hint]) => ({ key, label, hint }));

  useEffect(() => {
    try {
      setHasSaved(Boolean(window.localStorage.getItem("6native-smartfit-v1")));
    } catch {
      setMessage("Browser storage is unavailable. You can still use SmartFit and continue directly to a custom order.");
    }
  }, []);

  function applyEstimates(estimatesInCm: Record<string, string>) {
    const conversion = unit === "in" ? 1 / 2.54 : 1;
    setValues(Object.fromEntries(Object.entries(estimatesInCm).map(([key, value]) => [key, (Math.round(Number(value) * conversion * 10) / 10).toString()])));
  }

  function changeUnit(nextUnit: "cm" | "in") {
    if (nextUnit === unit) return;
    const conversion = nextUnit === "in" ? 1 / 2.54 : 2.54;
    const convert = (value: string) => value ? (Math.round(Number(value) * conversion * 10) / 10).toString() : "";
    setHeight(convert(height));
    setValues((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, convert(value)])));
    setUnit(nextUnit);
  }

  function savePrivately() {
    if (!profile || Object.keys(values).length === 0) {
      setMessage("Choose a fit profile and capture or enter measurements first.");
      return;
    }
    try {
      window.localStorage.setItem("6native-smartfit-v1", JSON.stringify({ profile, unit, values }));
      setHasSaved(true);
      setMessage("Measurements saved privately on this device. Camera images were not saved.");
    } catch {
      setMessage("Could not save measurements in this browser. Check device storage settings and try again.");
    }
  }

  function loadPrivately() {
    let saved: string | null;
    try {
      saved = window.localStorage.getItem("6native-smartfit-v1");
    } catch {
      setMessage("Could not access saved measurements. Check browser storage settings and try again.");
      return;
    }
    if (!saved) {
      setHasSaved(false);
      setMessage("No saved SmartFit measurements were found on this device.");
      return;
    }
    try {
      const parsed = JSON.parse(saved) as { profile?: unknown; unit?: unknown; values?: unknown };
      if (!isFitProfile(parsed.profile) || (parsed.unit !== "cm" && parsed.unit !== "in") || typeof parsed.values !== "object" || parsed.values === null) {
        throw new Error("Saved measurements have an invalid format.");
      }
      const savedValues = Object.fromEntries(Object.entries(parsed.values).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      setProfile(parsed.profile);
      setUnit(parsed.unit);
      setValues(savedValues);
      setMessage("Saved measurements loaded from this device. Please review them before sharing.");
    } catch {
      setMessage("Could not load the saved measurements. You can clear them and start again.");
    }
  }

  function clearSaved() {
    try {
      window.localStorage.removeItem("6native-smartfit-v1");
      setHasSaved(false);
      setMessage("Saved measurements have been removed from this device.");
    } catch {
      setMessage("Could not remove saved measurements. Please check your browser storage settings.");
    }
  }

  function continueWithMeasurements(event: React.MouseEvent<HTMLAnchorElement>) {
    const enteredValues = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
    if (!profile || Object.keys(enteredValues).length === 0) {
      event.preventDefault();
      setMessage("Choose a fit profile and enter or estimate at least one measurement to continue.");
      return;
    }
    try {
      window.sessionStorage.setItem("6native-self-measurements", JSON.stringify({ gender: profile, unit, values: enteredValues }));
    } catch {
      event.preventDefault();
      setMessage("Could not prepare your measurements for the order form. Please try again or enter them there manually.");
    }
  }

  return (
    <>
      <PageIntro label="A little help from the atelier" title={<>Measure with<br /><em>confidence.</em></>} description="SmartFit guides you through front and side camera views, then estimates measurements using your height for calibration. You can also enter them by hand." />
      <section className="fit-guide">
        <div className="fit-guide-intro"><Ruler size={22} /><div><b>Before you begin</b><p>Wear fitted clothing, stand naturally, and use a plain background with even lighting. Keep your full body visible in both views.</p></div></div>
        <div className="self-measurement-tool">
          <div className="self-measurement-heading"><div><Eyebrow>SMART SELF-MEASUREMENT</Eyebrow><h2>A better fit starts <em>with you.</em></h2><p>Choose your fit profile, enter your height, and let SmartFit guide your camera captures.</p></div><Ruler size={22} /></div>
          <div className="self-measurement-controls">
            <label>Fit profile<select value={profile} onChange={(event) => { const nextProfile = isFitProfile(event.target.value) ? event.target.value : ""; if (nextProfile !== profile && Object.keys(values).length) { setValues({}); setMessage("Fit profile changed. Please capture or enter measurements again."); } setProfile(nextProfile); }}><option value="">Choose a measurement guide</option><option value="women">Women’s fit</option><option value="men">Men’s fit</option><option value="neutral">Gender-neutral fit</option></select></label>
            <label>Unit<select value={unit} onChange={(event) => changeUnit(event.target.value === "in" ? "in" : "cm")}><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option></select></label>
            <label>Your height · calibration<input type="number" min={unit === "in" ? 48 : 120} max={unit === "in" ? 90 : 230} step="0.1" value={height} onChange={(event) => { setHeight(event.target.value); if (Object.keys(values).length) { setValues({}); setMessage("Height changed. Capture again or re-enter measurements using the updated calibration."); } }} placeholder={unit === "in" ? "e.g. 66" : "e.g. 168"} /></label>
          </div>
          <SmartFitCamera key={`${profile}-${heightInCm}`} profile={profile} heightCm={heightInCm} onMeasurements={applyEstimates} />
          <details className="manual-measurements">
            <summary>{completedCount ? "Review or edit measurements" : "Enter measurements manually instead"}</summary>
            {profile ? (
              <>
                <div className="measurement-progress">
                  <span>{completedCount} of {profileFields.length} measurements entered</span>
                  <div role="progressbar" aria-label="Measurements entered" aria-valuemin={0} aria-valuemax={profileFields.length} aria-valuenow={completedCount}><span style={{ width: `${profileFields.length ? completedCount / profileFields.length * 100 : 0}%` }} /></div>
                </div>
                <div className="measurement-grid self-measurement-grid">
                  {profileFields.map(({ key, label, hint }) => (
                    <label key={key} title={hint}>{label}<div className="measurement-input"><input aria-label={`${label} measurement`} type="number" min="0" max="300" step="0.1" value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder="—" /><span>{unit}</span></div><small>{hint}</small></label>
                  ))}
                </div>
              </>
            ) : <p className="measurement-prompt">Choose a fit profile to enter measurements.</p>}
            <p className="measurement-storage-note">Only your measurement values and fit profile are saved. Camera images and video are never saved.</p>
          </details>
          {message && <p className="form-status" role="status">{message}</p>}
          <div className="smartfit-save-actions">
            <button className="text-link" type="button" onClick={savePrivately} disabled={!profile || completedCount === 0}>Save privately on this device</button>
            {hasSaved && <><button className="text-link" type="button" onClick={loadPrivately}>Load saved measurements</button><button className="text-link smartfit-clear" type="button" onClick={clearSaved}>Remove saved data</button></>}
          </div>
          <Link className="button button-dark self-measurement-continue" to="/custom-tailoring" onClick={continueWithMeasurements}>Review with the tailor <ArrowRight size={16} /></Link>
        </div>
        <div className="fit-disclaimer"><b>Privacy & accuracy</b><p>Camera frames are analyzed on your device and not uploaded. The MediaPipe runtime is downloaded from jsDelivr on first use; the body landmark model is included with the page. Measurements are estimates based on camera positioning and your stated height; your tailor should review them before making begins.</p></div>
        <div className="fit-steps">
          {fieldsToShow.map(({ key, label, hint }, index) => <article key={`${key}-${label}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{label}</h2><p>{hint}</p></div><div className="fit-illustration"><Ruler size={18} /></div></article>)}
          <article><span>{String(fieldsToShow.length + 1).padStart(2, "0")}</span><div><h2>Cap · head circumference</h2><p>{capMeasurements[0][2]}</p></div><div className="fit-illustration"><Ruler size={18} /></div></article>
        </div>
      </section>
    </>
  );
}

const faqs = [
  ["How do I start a custom order?", "Tell us what you’re imagining on the custom tailoring page. You can share your garment idea, measurements, preferred fabric and a reference image. Our atelier will discuss the design and confirm a quote and timeline with you before work begins."],
  ["What is the minimum custom order?", "Custom orders start at ₦50,000. The final quote depends on the garment, fabric and finishing details, and is shared for your approval before work begins."],
  ["Can you help me choose a fabric?", "Yes. Share the look, feel and occasion you have in mind. We’ll discuss suitable fabric options and current availability with you before confirming the quote."],
  ["Do you offer alterations and repairs?", "We can assess alteration and repair requests. The price depends on the garment and work needed, so please share details and we’ll provide a quote before starting."],
  ["When do I pay?", "Payment terms are confirmed with your quote before work begins. Please contact the atelier for the terms that apply to your order."],
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

export function PrivacyPage() {
  return (
    <>
      <PageIntro label="Your information" title={<>Privacy, with<br /><em>care.</em></>} description="How this website handles information you choose to share with 6Native Tailor." />
      <section className="policy-page">
        <article><span>01</span><div><h2>Information you enter</h2><p>The custom request form keeps your details in the page while you fill it in. This site does not currently save your request or upload reference images to a 6Native Tailor server.</p></div></article>
        <article><span>02</span><div><h2>Choosing to contact us</h2><p>If you continue to WhatsApp, the message text you choose to send is handled by WhatsApp under its own privacy terms. Reference images are only previewed in your browser; you attach them in WhatsApp yourself.</p></div></article>
        <article><span>03</span><div><h2>Shopping and newsletter</h2><p>The current shopping bag is held in page memory and is cleared when you leave or refresh. Newsletter signup and checkout are not connected, and this website does not submit those details.</p></div></article>
        <article><span>04</span><div><h2>Questions</h2><p>Please contact 6Native Tailor before entering sensitive information. A direct contact channel will be listed here when the business contact details are configured.</p></div></article>
        <div className="policy-note"><b>Service status</b><p>This notice describes the website as it works today. It should be reviewed if booking, payment, analytics or data-storage services are added.</p></div>
      </section>
    </>
  );
}

export function NotFoundPage() {
  return <section className="not-found"><Eyebrow>A little detour</Eyebrow><h1>This page isn’t<br /><em>stitched yet.</em></h1><p>Let’s take you back to the atelier.</p><Link className="button button-dark" to="/">Return home <ArrowRight size={16} /></Link></section>;
}
