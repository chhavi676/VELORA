import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Heart, Menu, Search, ShoppingBag, X } from "lucide-react";
import { models as demoModels, products as demoProducts, shows as demoShows } from "./data.js";
import { getHealth, getProducts, getShows, getModels } from "./services/api.js";
import AuthPanel from "./components/AuthPanel.jsx";
import ProductPage from "./components/ProductPage.jsx";
import CheckoutPage from "./components/CheckoutPage.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { useAuth } from "./lib/auth.jsx";
import { useCart, lineKey } from "./lib/cart.js";
import { money, productHref } from "./lib/format.js";
import "./components/pages.css";

function parseRoute(hash) {
  if (hash.startsWith("#/product/")) return { name: "product", slug: decodeURIComponent(hash.slice("#/product/".length)) };
  if (hash === "#/checkout") return { name: "checkout" };
  if (hash.startsWith("#/dashboard")) return { name: "dashboard", tab: hash.split("/")[2] || "" };
  return { name: "home" };
}
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const on = () => setHash(window.location.hash); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  return { route: parseRoute(hash), hash };
}

function Header({ cartCount, onCart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile } = useAuth();
  return <header className="header">
    <button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
    <a className="wordmark" href="#home" aria-label="VÉLORA home">VÉLORA<span>®</span></a>
    <nav className={menuOpen ? "nav nav-open" : "nav"}>
      <a href="#discover" onClick={() => setMenuOpen(false)}>Discover</a><a href="#runway" onClick={() => setMenuOpen(false)}>Runway</a><a href="#shop" onClick={() => setMenuOpen(false)}>Shop</a><a href="#talent" onClick={() => setMenuOpen(false)}>Talent</a><a className="nav-account" href={profile ? "#/dashboard" : "#account"} onClick={() => setMenuOpen(false)}>{profile ? (profile.role === "customer" ? "My orders" : "Dashboard") : "Sign in"}</a>
    </nav>
    <div className="header-actions"><a className="search-link" href="#shop"><Search size={17}/><span>Search</span></a><a className="account-link" href={profile ? "#/dashboard" : "#account"}>{profile ? (profile.role === "customer" ? "My orders" : `${profile.role} dashboard`) : "Sign in"}</a><button className="icon-button bag-button" aria-label="Open shopping bag" onClick={onCart}><ShoppingBag size={19}/><span className="cart-count">{cartCount}</span></button></div>
  </header>;
}

function App() {
  // Start empty and show real data from the API. Offline demo data is only a fallback when the API is unreachable.
  const [catalogue, setCatalogue] = useState([]);
  const [showList, setShowList] = useState([]);
  const [modelList, setModelList] = useState([]);
  const [catalogueStatus, setCatalogueStatus] = useState("loading");
  const cart = useCart();
  const { route, hash } = useHashRoute();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getHealth().then(() => setApiStatus("connected")).catch(() => setApiStatus("offline"));
    getProducts().then((data) => { if (Array.isArray(data)) { setCatalogue(data); setCatalogueStatus("ready"); } }).catch((error) => { console.error(error); setCatalogue(demoProducts); setCatalogueStatus("offline"); });
    getShows().then((data) => { if (Array.isArray(data)) setShowList(data); }).catch(() => setShowList(demoShows));
    getModels().then((data) => { if (Array.isArray(data)) setModelList(data); }).catch(() => setModelList(demoModels));
  }, []);

  const categories = ["All", ...new Set(catalogue.map((p) => p.category))];
  const filteredProducts = useMemo(() => catalogue.filter((p) => {
    const matchCategory = category === "All" || p.category === category;
    return matchCategory && `${p.name} ${p.designer} ${p.category}`.toLowerCase().includes(search.toLowerCase());
  }), [catalogue, category, search]);

  const flash = (message) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const addToCart = (product, size = "") => {
    if (!product.slug) { flash("The store is offline right now. Start the API server to shop."); return; } // offline demo items cannot be ordered
    if (product.inventory !== undefined && product.inventory <= 0) { flash(`${product.name} is sold out`); return; }
    if ((product.sizes || []).length && !size) { window.location.hash = productHref(product); flash("Choose a size to add this piece"); return; }
    cart.add(product, size);
    flash(`${product.name}${size ? ` (${size})` : ""} added to your bag`);
  };

  // Scroll handling for the hash router: top for sub-pages, to the section for home anchors.
  useEffect(() => {
    if (route.name !== "home") { window.scrollTo({ top: 0 }); return; }
    const id = hash.replace(/^#/, "");
    if (id) window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [route.name, route.slug, hash]); // eslint-disable-line react-hooks/exhaustive-deps

  const cartCount = cart.count;
  const cartTotal = cart.total;

  return <div id="home" className="site-shell">
    <div className="announcement">THE NEW SEASON, CONSIDERED. <span>EXPLORE THE EDIT <ArrowRight size={12}/></span></div>
    <Header cartCount={cartCount} onCart={() => setCartOpen(true)}/>
    <main>
      {route.name === "product" && <ProductPage slug={route.slug} catalogue={catalogue} onAdd={addToCart} />}
      {route.name === "checkout" && <CheckoutPage cart={cart} />}
      {route.name === "dashboard" && <Dashboard tab={route.tab} notify={flash} />}
      {route.name === "home" && <>
      <section className="hero"><img className="hero-image" src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=2200&q=90" alt="Fashion editorial campaign"/><div className="hero-overlay"></div><div className="hero-copy"><p className="eyebrow light">ISSUE NO. 01 · THE RUNWAY EDIT</p><h1>Fashion is<br/><em>a point of view.</em></h1><p className="hero-subtitle">Discover the looks, the people, and the ideas shaping what comes next.</p><a className="light-cta" href="#discover">ENTER THE EDIT <ArrowDownRight size={16}/></a></div><div className="hero-index"><span>01</span><i></i><span>03</span></div><div className="hero-caption">A NEW LANGUAGE OF LUXURY <span>EST. MMXXVI</span></div></section>
      <section className="intro section-pad" id="discover"><div><p className="eyebrow">NOT JUST WHAT YOU WEAR</p><h2>A world of fashion,<br/><em>seen differently.</em></h2></div><p className="intro-text">From the front row to the final detail, discover the designers, runway moments, and emerging talent worth knowing.</p></section>
      <section className="show-section section-pad" id="runway"><div className="section-heading"><div><p className="eyebrow">THE FASHION CALENDAR</p><h2>On the <em>runway.</em></h2></div><a className="text-link" href="#runway-grid">VIEW ALL SHOWS <ArrowUpRight size={15}/></a></div><div className="show-grid" id="runway-grid">
        {showList.map((show, index) => <article className={`show-card show-card-${index + 1}`} key={show.id || show.slug}><a href="#shop" className="show-image-wrap"><img src={show.image} alt={`${show.title} fashion show editorial`} loading="lazy"/><span className="image-arrow"><ArrowUpRight size={18}/></span></a><div className="show-meta"><span>{show.city} · {show.season}</span><span>0{index + 1}</span></div><h3>{show.title}</h3></article>)}
      </div></section>
      <section className="shop-section section-pad" id="shop"><div className="section-heading"><div><p className="eyebrow">CURATED, NOT CROWDED</p><h2>The considered <em>edit.</em></h2></div><p className="section-note">Pieces with a point of view.<br/>Selected for the way they make you feel.</p></div>
        <div className="shop-toolbar"><div className="category-list">{categories.map((item) => <button key={item} className={category === item ? "category-chip active" : "category-chip"} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="product-search"><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the edit" aria-label="Search products"/></label></div>
        <div className="product-grid">{filteredProducts.map((product) => <article className="product-card" key={product.id || product.slug}><div className="product-image-wrap"><a href={productHref(product)} aria-label={`View ${product.name}`}><img src={product.image || product.images?.[0]?.url} alt={product.name} loading="lazy"/></a><span className="product-tag">{product.inventory !== undefined && product.inventory <= 0 ? "SOLD OUT" : product.tag || product.category}</span><button className="wishlist-button" aria-label={`Save ${product.name}`} onClick={() => setNotice("Wishlist will be connected to your account in a later stage")}><Heart size={17}/></button><button className="quick-add" onClick={() => addToCart(product)} disabled={product.inventory !== undefined && product.inventory <= 0}>{product.inventory !== undefined && product.inventory <= 0 ? "SOLD OUT" : (product.sizes || []).length ? "CHOOSE SIZE" : "ADD TO BAG"} <span>+</span></button></div><div className="product-meta"><div><h3><a href={productHref(product)}>{product.name}</a></h3><p>{product.designer}</p></div><strong>{money(product.price)}</strong></div></article>)}</div>
        {catalogueStatus === "loading" && <p className="empty-state">Loading the edit…</p>}{catalogueStatus === "offline" && <p className="empty-state">The store API is offline, so you are seeing a static preview. Start the server (npm run dev) to browse and order real products.</p>}{catalogueStatus !== "loading" && filteredProducts.length === 0 && <p className="empty-state">No pieces match your search. Try another term.</p>}<div className="center-action"><button className="outline-cta" onClick={() => { setSearch(""); setCategory("All"); }}>VIEW THE FULL EDIT <ArrowRight size={15}/></button></div>
      </section>
      <section className="campaign"><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=85" alt="Editorial fashion campaign" loading="lazy"/><div className="campaign-copy"><p className="eyebrow light">THE ART OF BEING SEEN</p><h2>Wear the<br/><em>unexpected.</em></h2><a href="#talent" className="light-cta">DISCOVER THE PEOPLE <ArrowRight size={15}/></a></div></section>
      <section className="talent-section section-pad" id="talent"><div className="section-heading"><div><p className="eyebrow">FACES TO KNOW</p><h2>Meet the <em>talent.</em></h2></div><a className="text-link" href="#talent">EXPLORE MODEL PORTFOLIOS <ArrowUpRight size={15}/></a></div><div className="model-grid">{modelList.map((model, index) => <article className="model-card" key={model.id || model.slug}><a href="#talent" className="model-image"><img src={model.image || model.portraitUrl} alt={`Demonstration portfolio portrait for ${model.name || model.displayName}`} loading="lazy"/><span>0{index + 1}</span></a><p className="model-role">{model.role || (model.specialties || []).join(" · ").toUpperCase()} · {model.isDemoProfile === false ? "PORTFOLIO" : "DEMO PROFILE"}</p><h3>{model.name || model.displayName}</h3></article>)}</div><p className="demo-note">Show, product, and model entries are assignment demo data. Verify all event details, credits, image rights, and model identities before public publication.</p></section>
      <section className="account-section section-pad" id="account"><div className="section-heading"><div><p className="eyebrow">YOUR VÉLORA</p><h2>A personal <em>point of view.</em></h2></div><p className="section-note">Sign in to access your profile.<br/>New accounts begin as customers.</p></div><AuthPanel /></section>
      <section className="newsletter section-pad"><div><p className="eyebrow">THE VÉLORA LETTER</p><h2>A closer look at<br/><em>what's next.</em></h2></div><form onSubmit={(e) => { e.preventDefault(); setNotice("Newsletter sign-up will be connected to a backend service in a later stage."); }}><label htmlFor="email">Occasional notes on fashion, people, and perspective.</label><div className="email-row"><input id="email" type="email" required placeholder="Your email address"/><button aria-label="Subscribe"><ArrowRight/></button></div><small>By subscribing, you agree to receive editorial updates.</small></form></section>
      </>}
    </main>
    <footer className="footer"><div className="footer-top"><a className="wordmark footer-mark" href="#home">VÉLORA<span>®</span></a><p>THE ART OF BEING SEEN.</p><a href="#home" className="back-top">BACK TO TOP ↑</a></div><div className="footer-bottom"><span>© 2026 VÉLORA STUDIO · ASSIGNMENT DEMO</span><div><a href="#discover">DISCOVER</a><a href="#runway">RUNWAY</a><a href="#shop">SHOP</a><a href="#talent">TALENT</a><a href="#account">ACCOUNT</a></div></div></footer>
    {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(e) => e.stopPropagation()}><div className="drawer-heading"><div><p className="eyebrow">YOUR SELECTION</p><h2>Shopping bag <span>({cartCount})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close bag"><X/></button></div>
      {cart.items.length === 0 ? <div className="cart-empty"><ShoppingBag size={30}/><p>Your bag is waiting for something considered.</p><button className="outline-cta" onClick={() => setCartOpen(false)}>CONTINUE EXPLORING</button></div> : <><div className="cart-items">{cart.items.map((item) => <div className="cart-item" key={lineKey(item)}><img src={item.image} alt=""/><div className="cart-item-info"><h3><a href={productHref(item)} onClick={() => setCartOpen(false)}>{item.name}</a></h3><p>{item.designer}{item.size ? ` · Size ${item.size}` : ""}</p><div className="quantity-control"><button onClick={() => cart.setQuantity(lineKey(item), item.quantity - 1)} aria-label="Decrease quantity">−</button><span>{item.quantity}</span><button onClick={() => cart.setQuantity(lineKey(item), item.quantity + 1)} aria-label="Increase quantity">+</button><button className="remove-item" onClick={() => cart.remove(lineKey(item))}>Remove</button></div></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="cart-total"><div><span>Subtotal</span><strong>{money(cartTotal)}</strong></div><p>Complimentary shipping. Pay on delivery.</p><button className="checkout-button" onClick={() => { setCartOpen(false); window.location.hash = "#/checkout"; }}>CONTINUE TO CHECKOUT <ArrowRight size={16}/></button></div></>}
    </aside></div>}
    <div className="api-indicator" title="Backend API status"><span className={apiStatus === "connected" ? "status-dot online" : "status-dot"}></span> API {apiStatus === "checking" ? "CHECKING" : apiStatus === "connected" ? "CONNECTED" : "OFFLINE"}</div>
  </div>;
}

export default App;