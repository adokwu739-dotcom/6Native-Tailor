import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  Moon,
  ShoppingBag,
  Sun,
  X,
} from "lucide-react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { formatNaira, type Product } from "./catalog";
import {
  AtelierPage,
  CarePage,
  CustomOrderPage,
  FaqPage,
  FitGuidePage,
  HomePage,
  NotFoundPage,
  OurStoryPage,
  ShippingPage,
  ShopPage,
  StyleAssistantPage,
} from "./pages";

function BrandLogo() {
  return (
    <Link className="brand-lockup" to="/" aria-label="6Native Tailor home">
      <svg className="brand-emblem" viewBox="0 0 48 48" role="img" aria-label="6Native emblem">
        <path d="M25 5 8 15v18l16 10 16-10V15L25 5Z" />
        <path d="M30 14c-2-2-5-3-8-2-5 1-8 6-8 12 0 7 4 11 10 11 5 0 9-4 9-9 0-5-3-8-8-8-3 0-5 1-7 4" />
        <path d="M25 6v5M9 15l4 2m28-2-4 2m-5 20 2 4m-19-4-2 4" />
        <circle cx="24" cy="25" r="1.25" />
      </svg>
      <span className="brand-type"><b>6NATIVE</b><small>TAILORING HOUSE · ABUJA</small></span>
    </Link>
  );
}

function App() {
  const [cart, setCart] = useState<Product[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storedTheme = window.localStorage.getItem("6native-theme");
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.localStorage.setItem("6native-theme", theme);
  }, [theme]);

  function addToBag(product: Product) {
    setCart((items) => [...items, product]);
    setNotice(`${product.name} added to your bag`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function toggleSaved(id: string) {
    setSaved((items) => (items.includes(id) ? items.filter((item) => item !== id) : [...items, id]));
  }

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="site-shell" data-theme={theme}>
      <div className="announcement">
        <span>Complimentary delivery on orders over ₦150,000</span>
        <Link to="/shop">Discover the new season <ArrowUpRight size={13} /></Link>
      </div>
      <header className="header">
        <button className="icon-button mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav id="primary-navigation" className={`nav nav-left ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          <NavLink to="/shop">Shop</NavLink>
          <NavLink to="/our-story">Our story</NavLink>
          <NavLink to="/atelier">The atelier</NavLink>
        </nav>
        <BrandLogo />
        <nav className="nav nav-right" aria-label="Customer navigation">
          <NavLink to="/customer-care">Customer care</NavLink>
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open shopping bag, ${cart.length} items`}>
            <ShoppingBag size={17} strokeWidth={1.6} />
            <span>Bag</span>
            <span className="bag-count">{cart.length}</span>
          </button>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />} />
          <Route path="/shop" element={<ShopPage addToBag={addToBag} saved={saved} toggleSaved={toggleSaved} />} />
          <Route path="/custom-tailoring" element={<CustomOrderPage />} />
          <Route path="/style-assistant" element={<StyleAssistantPage />} />
          <Route path="/customer-care" element={<CarePage />} />
          <Route path="/atelier" element={<AtelierPage />} />
          <Route path="/our-story" element={<OurStoryPage />} />
          <Route path="/fit-guide" element={<FitGuidePage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/shipping-returns" element={<ShippingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <BrandLogo />
            <p>Crafted for your identity.<br />Made with meaning in Abuja, Nigeria.</p>
          </div>
          <div className="footer-column"><h3>Explore</h3><Link to="/shop">Shop all</Link><Link to="/custom-tailoring">Custom tailoring</Link><Link to="/atelier">Our atelier</Link><Link to="/our-story">Our story</Link></div>
          <div className="footer-column"><h3>We're here</h3><Link to="/customer-care">Customer care</Link><Link to="/faq">Frequently asked questions</Link><Link to="/shipping-returns">Shipping & returns</Link><Link to="/fit-guide">Measurement guide</Link></div>
          <Newsletter />
        </div>
        <div className="footer-bottom">
          <span>© 2026 6Native Tailor. All rights reserved.</span>
          <span>Made with care in Abuja <span className="footer-heart">♥</span></span>
          <Link to="/customer-care">Contact us <ArrowUpRight size={12} /></Link>
        </div>
      </footer>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      {cartOpen && (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="cart-drawer" aria-label="Shopping bag">
            <div className="drawer-heading"><div><p className="eyebrow">YOUR SELECTION</p><h2>Your bag <span>({cart.length})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X size={20} /></button></div>
            {cart.length === 0 ? (
              <div className="empty-bag"><ShoppingBag size={28} strokeWidth={1.2} /><p>Your bag is taking a little breather.</p><button className="text-link" onClick={() => setCartOpen(false)}>Find something lovely <ArrowRight size={15} /></button></div>
            ) : (
              <>
                <div className="cart-lines">{cart.map((item, index) => (
                  <div className="cart-line" key={`${item.id}-${index}`}><img src={item.image} alt="" /><div className="cart-line-info"><h3>{item.name}</h3><p>{formatNaira(item.price)}</p><button onClick={() => setCart((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div><span className="cart-qty">1</span></div>
                ))}</div>
                <div className="cart-bottom"><div className="cart-total"><span>Subtotal</span><b>{formatNaira(total)}</b></div><p>Delivery calculated at checkout.</p><button className="button button-dark checkout-button" onClick={() => { setCartOpen(false); setNotice("Secure checkout is not connected yet."); window.setTimeout(() => setNotice(""), 2600); }}>Continue to checkout <ArrowRight size={16} /></button><span className="secure-note">Thoughtfully made. Secure checkout coming soon.</span></div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Newsletter() {
  const [message, setMessage] = useState("");
  return (
    <div className="newsletter">
      <h3>A little note from us.</h3>
      <p>New work, studio stories, and things worth keeping.</p>
      <form onSubmit={(event) => { event.preventDefault(); setMessage("Newsletter signup will be available soon."); }}>
        <label className="sr-only" htmlFor="newsletter-email">Your email address</label>
        <input id="newsletter-email" type="email" placeholder="Your email address" required />
        <button type="submit" aria-label="Subscribe to newsletter"><ArrowRight size={17} /></button>
      </form>
      {message && <span className="newsletter-note" role="status">{message}</span>}
    </div>
  );
}

export default App;
