import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowRight, Check, Heart, Menu, Minus,
  Plus, Search, ShoppingBag, Sparkles, UserRound, X
} from "lucide-react";
import { categories, developmentMenu } from "./menu.js";
import { EventBookingWizard, EventsSection } from "./Events.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

const money = (kobo) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN"
}).format(kobo / 100);

function dateInBusinessTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const imageSource = (url) => url.replaceAll("%2C", ",");

const builderChoices = {
  waffle: {
    title: "Build your waffle",
    intro: "A little golden, a little gooey, completely yours.",
    base: ["Classic Belgian", "Chocolate waffle", "Mini waffle"],
    iceCream: ["Vanilla bean", "Pistachio", "Strawberry", "Dark chocolate"],
    toppings: ["Fresh strawberries", "Brownie bites", "Toasted hazelnuts", "Cookie crumble", "Rainbow sprinkles"],
    sauces: ["Dark chocolate", "Salted caramel", "Strawberry"]
  },
  sundae: {
    title: "Make a sundae",
    intro: "Pick your scoop, then make it wonderfully extra.",
    base: ["Little cup", "Big bowl", "Share the love"],
    iceCream: ["Vanilla bean", "Pistachio", "Strawberry", "Dark chocolate"],
    toppings: ["Brownie bites", "Cookie crumble", "Toasted hazelnuts", "Fresh strawberries"],
    sauces: ["Dark chocolate", "Salted caramel", "Strawberry"]
  },
  candy: {
    title: "Mix your candy",
    intro: "A little sour, a little sweet. Your perfect handful.",
    base: ["Little pouch", "Share bag", "Party jar"],
    iceCream: [],
    toppings: ["Sour belts", "Gummy bears", "Fruit chews", "Chocolate buttons", "Cola bottles"],
    sauces: []
  },
  popcorn: {
    title: "Make it pop",
    intro: "Pick a flavor, then make movie night yours.",
    base: ["Little bag", "Big bowl", "Movie-night tub"],
    iceCream: [],
    toppings: ["Sea salt", "Caramel drizzle", "Cheddar dust", "Chocolate chips", "Cinnamon sugar"],
    sauces: []
  },
  "cotton-candy": {
    title: "Spin your cotton candy",
    intro: "Cloud-soft, bright, and made to feel extra celebratory.",
    base: ["Small cloud", "Medium cloud", "Party pile"],
    iceCream: ["Classic pink", "Blue raspberry", "Strawberry", "Vanilla", "Rainbow mix"],
    toppings: ["Pastel sugar dust", "Lavender swirl", "Berry sugar", "Cotton candy glitter"],
    sauces: ["Gift box wrap", "Party pack sleeve", "Custom tag"]
  },
  "ice-cream-cone": {
    title: "Build your ice cream cone",
    intro: "Choose the cone, pick the scoop, and finish it with your favorite little extras.",
    base: ["Classic waffle cone", "Sugar cone", "Chocolate-dipped cone", "Premium waffle cone"],
    iceCream: ["Vanilla bean", "Chocolate", "Strawberry", "Pistachio", "Cookies & cream"],
    toppings: ["Chocolate chips", "Sprinkles", "Crushed cookies", "Nuts", "Caramel bits"],
    sauces: ["Chocolate sauce", "Caramel drizzle", "Strawberry sauce"]
  }
};

const startingPrices = {
  waffle: { base: 790, iceCream: 180, toppings: 90, sauces: 75 },
  sundae: { base: 490, iceCream: 160, toppings: 90, sauces: 75 },
  candy: { base: 450, iceCream: 0, toppings: 100, sauces: 0 },
  popcorn: { base: 390, iceCream: 0, toppings: 70, sauces: 0 },
  "cotton-candy": { base: 340, iceCream: 120, toppings: 80, sauces: 60 },
  "ice-cream-cone": { base: 420, iceCream: 140, toppings: 70, sauces: 60 }
};

function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("swert-guest-cart") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function App() {
  if (window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/")) {
    return <AdminDashboard />;
  }
  const [products, setProducts] = useState(developmentMenu);
  const [menuIsDemo, setMenuIsDemo] = useState(true);
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(developmentMenu.length);
  const [sort, setSort] = useState("featured");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("swert-guest-wishlist") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [cart, setCart] = useState(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [builder, setBuilder] = useState(null);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [eventBooking, setEventBooking] = useState(null);
  const [user, setUser] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (category !== "all") params.set("category", category);
      if (query.trim()) params.set("search", query.trim());
      params.set("sort", sort);
      fetch(`/api/products?${params}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("The catalog is unavailable.");
          return response.json();
        })
        .then((result) => {
          if (!active || !Array.isArray(result.products)) return;
          const products = result.products.map((product) => {
            if (product.slug === "movie-night-popcorn") {
              return { ...product, imageUrl: "/krunchy/KrunchyKremmy%20Popcorn%20Bag%20Mockup.png" };
            }
            if (product.slug === "strawberry-sunday") {
              return { ...product, imageUrl: "https://images.unsplash.com/photo-1558584724-0e4d32ca55a4?auto=format&fit=crop&w=900&q=82" };
            }
            if (product.slug === "chocolate-dream-waffle") {
              return { ...product, imageUrl: "/krunchy/Chocolate%20Dream%20Waffle%20Slice.png" };
            }
            return product;
          });
          setProducts((current) => page === 1 ? products : [...current, ...products]);
          setTotalProducts(result.total);
          setMenuIsDemo(false);
        })
        .catch((error) => {
          if (!active || error.name === "AbortError") return;
          setProducts(developmentMenu);
          setTotalProducts(developmentMenu.length);
          setMenuIsDemo(true);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, page, query, sort]);

  useEffect(() => {
    localStorage.setItem("swert-guest-cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("swert-guest-wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result?.user) setUser(result.user); })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get("verify_token");
    const resetToken = params.get("reset_token");
    if (verificationToken || resetToken) {
      setAuthToken({ type: verificationToken ? "verify" : "reset", token: verificationToken || resetToken });
      setAccountOpen(true);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (params.get("checkout") === "cancelled") {
      setNotice("Checkout was cancelled. Your bag is still here.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (params.get("checkout") !== "success" || !reference) return;
    fetch(`/api/payments/verify/${encodeURIComponent(reference)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Payment status could not be verified.");
        if (result.paymentStatus === "PAID") {
          setCart([]);
          setNotice(result.status === "PAYMENT_REVIEW"
            ? `Payment received for order ${result.orderNumber}. Our team is reviewing the expired fulfilment reservation before confirming it.`
            : `Thank you! Order ${result.orderNumber} is confirmed.`);
        } else {
          setNotice(`Order ${result.orderNumber} is awaiting payment confirmation.`);
        }
      })
      .catch(() => setNotice("Payment confirmation is still being verified. Please check your email before placing another order."))
      .finally(() => window.history.replaceState({}, "", window.location.pathname));
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === "all" || product.category === category || product.category?.slug === category;
    const text = `${product.name} ${product.description} ${product.categoryName || ""}`.toLowerCase();
    return matchesCategory && text.includes(query.trim().toLowerCase());
  }), [category, products, query]);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + item.priceCents * item.quantity, 0);

  function addToCart(item) {
    setCart((current) => [...current, { ...item, lineId: crypto.randomUUID(), quantity: item.quantity || 1 }]);
    setNotice(`${item.name} added to your bag.`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function changeQuantity(lineId, delta) {
    setCart((current) => current
      .map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }

  function openShop(selectedCategory = "all") {
    setCategory(selectedCategory);
    setPage(1);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    setMobileNavOpen(false);
  }

  return (
    <>
      <div className="announcement">
        <span>Every Bite, A Little More Joy.</span>
        <span className="announcement-right">Small-batch treats, made with love <span aria-hidden="true">✳</span></span>
      </div>
      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          {mobileNavOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <a className="wordmark" href="#home" aria-label="KrunchyKremmy home">KrunchyKremmy</a>
        <nav className={mobileNavOpen ? "main-nav nav-open" : "main-nav"} aria-label="Main navigation">
          <a href="#shop" onClick={() => { setCategory("all"); setPage(1); }}>Shop all</a>
          <a href="#categories">Our treats</a>
          <a href="#events">Events &amp; Catering</a>
          <a href="#build">Make it yours</a>
          <a href="#story">Our little story</a>
        </nav>
        <div className="header-actions">
          <button className="account-button" onClick={() => setAccountOpen(true)} aria-label={user ? `Account for ${user.name}` : "Sign in or create an account"}>
            <UserRound size={17} /><span>{user?.name || "Account"}</span>
          </button>
          <button className="icon-button search-toggle" aria-label="Search treats" onClick={() => {
            document.getElementById("product-search")?.focus();
            document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
          }}><Search size={19} /></button>
          <button className="bag-button" onClick={() => setCartOpen(true)} aria-label={`Open bag, ${cartCount} items`}>
            <ShoppingBag size={18} /><span className="bag-label">Your bag</span><span className="bag-count">{cartCount}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-mark">✳</span> Welcome to the sweet side of life</p>
            <h1>Welcome to the<br />Sweet Side of <em>Life!</em></h1>
            <p className="hero-description">Find a scoop, savour a freshly made meal, or raise a glass to the moment. KrunchyKremmy brings treats, refreshing drinks, and event catering together in one happy place.</p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={() => openShop()}>Find your treat <ArrowRight size={17} /></button>
              <button className="text-link" onClick={() => document.getElementById("build")?.scrollIntoView({ behavior: "smooth" })}>Make it your own <ArrowDownRight size={16} /></button>
            </div>
            <div className="hero-footnote"><span className="tiny-sun">✳</span> Made for the moments worth savoring</div>
          </div>
          <div className="hero-art">
            <img src="/krunchy/Pastel%20KrunchyKremmy%20Dessert%20Cart.png" alt="Pastel KrunchyKremmy dessert cart" />
            <div className="hero-sticker"><span>made with</span><strong>a little<br />extra love</strong><span>✳ since day one</span></div>
            <span className="hero-caption">The Sunday best <span>—</span> strawberry, vanilla &amp; a crisp bite</span>
          </div>
          <div className="hero-index">01 <span>/</span> 04</div>
        </section>

        <section className="category-section section-wrap" id="categories">
          <div className="section-heading">
            <div><p className="eyebrow">Good things, this way</p><h2>A little something<br className="mobile-break" /> for every <em>craving.</em></h2></div>
            <p className="section-intro">Sweet treats, savoury favourites, and sips<br className="desktop-break" /> for everyday and celebration.</p>
          </div>
          <div className="category-grid">
            {categories.map((item, index) => (
              <button className={`category-card ${item.className}`} key={item.slug} onClick={() => openShop(item.slug)}>
                <img src={imageSource(item.imageUrl)} alt="" loading="lazy" />
                <span className="category-number">0{index + 1} / THE GOOD STUFF</span>
                <span className="category-copy"><span><strong>{item.name}</strong><small>{item.description}</small></span><span className="round-arrow"><ArrowRight size={18} /></span></span>
              </button>
            ))}
          </div>
        </section>

        <EventsSection onBook={(eventPackage) => setEventBooking(eventPackage || {})} />

        <section className="shop-section" id="shop">
          <div className="section-wrap">
            <div className="shop-top">
              <div><p className="eyebrow">A few very good ideas</p><h2>Meet your <em>new favorite.</em></h2></div>
              <div className="shop-controls">
                <label className="search-field"><Search size={17} /><input id="product-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Find something lovely" /><button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setPage(1); }}><X size={15} /></button></label>
                <label className="sort-field"><span>Sort by</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
              </div>
            </div>
            <div className="filter-row" aria-label="Filter products by category">
              {["all", ...categories.map((item) => item.slug)].map((slug) => (
                <button key={slug} className={category === slug ? "filter-chip active" : "filter-chip"} onClick={() => { setCategory(slug); setPage(1); }}>
                  {slug === "all" ? "Everything" : categories.find((item) => item.slug === slug)?.name}
                </button>
              ))}
              {menuIsDemo && <span className="demo-label"><span /> Sample menu</span>}
            </div>
            {filteredProducts.length === 0 ? (
              <div className="empty-results"><Sparkles size={25} /><h3>No treats found just yet.</h3><p>Try a different search or browse everything sweet.</p><button className="text-link" onClick={() => { setQuery(""); setCategory("all"); }}>Clear filters <ArrowRight size={16} /></button></div>
            ) : (
              <div className="product-grid">
                {filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => product.customizationOptions?.length ? setSelectedProduct(product) : addToCart(product)} onView={() => setSelectedProduct(product)} isFavorite={wishlist.includes(product.id)} onFavorite={() => setWishlist((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} />)}
              </div>
            )}
            <div className="centered-action"><button className="button button-outline" onClick={() => {
              if (!menuIsDemo && products.length < totalProducts) setPage((current) => current + 1);
              else { setCategory("all"); setPage(1); setQuery(""); }
            }}>{!menuIsDemo && products.length < totalProducts ? "Load more treats" : "See all the good stuff"} <ArrowRight size={17} /></button></div>
          </div>
        </section>

        <section className="builder-banner section-wrap" id="build">
          <div className="builder-photo"><img src="/images/KrunchyKremmy%20Instagram%20Party%20Frame.png" alt="Waffle treats arranged in KrunchyKremmy party frames" loading="lazy" /><span className="photo-note">your masterpiece, incoming</span></div>
          <div className="builder-copy">
            <p className="eyebrow"><span className="eyebrow-mark">✳</span> The fun part</p>
            <h2>Your treat.<br /><em>Your rules.</em></h2>
            <p>Pick your base. Add the things you love. Make something that tastes like you.</p>
            <div className="builder-links">
              <button onClick={() => setBuilder("waffle")}><span>01</span> Build a waffle <ArrowRight size={17} /></button>
              <button onClick={() => setBuilder("sundae")}><span>02</span> Make a sundae <ArrowRight size={17} /></button>
              <button onClick={() => setBuilder("ice-cream-cone")}><span>03</span> Build a cone <ArrowRight size={17} /></button>
              <button onClick={() => setBuilder("candy")}><span>04</span> Mix your candy <ArrowRight size={17} /></button>
              <button onClick={() => setBuilder("cotton-candy")}><span>05</span> Spin cotton candy <ArrowRight size={17} /></button>
              <button onClick={() => setBuilder("popcorn")}><span>06</span> Make it pop <ArrowRight size={17} /></button>
            </div>
            <p className="fine-print">Builder prices shown are estimates until a live menu is connected.</p>
          </div>
        </section>

        <section className="little-joy section-wrap" id="story">
          <span className="joy-flower">✳</span>
          <p className="eyebrow">A little note from us</p>
          <h2>Not just dessert.<br />A <em>reason to pause.</em></h2>
          <p>We believe the everyday deserves a little extra. So we make the good stuff in small batches, with ingredients we love and room for one more topping.</p>
          <button className="text-link" onClick={() => setNotice("Our story is coming soon. Thanks for being here.")}>Get to know us <ArrowRight size={16} /></button>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a className="wordmark" href="#home">KrunchyKremmy</a>
            <p>Every Bite, A Little More Joy.<br />Made with love, meant to be enjoyed.</p>
            <nav className="footer-socials" aria-label="Social media">
              <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.8" r="1.1" /></svg>
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.8l.4-3.1h-3.2v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8h3.4Z" /></svg>
              </a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.6 8.3a7.3 7.3 0 0 1-4.5-1.5v7.1a5.6 5.6 0 1 1-5.6-5.6c.4 0 .8 0 1.2.1v3.1a2.6 2.6 0 1 0 1.5 2.4V3h3.1c.2 2 1.7 3.6 3.7 3.9v1.4h.6Z" /></svg>
              </a>
              <a href="https://www.whatsapp.com/" target="_blank" rel="noreferrer" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 8.1c-.2-.5-.5-.5-.8-.5h-.6c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.3-.1-.1-.3-.2-.7-.4l-1.8-.9c-.2-.1-.4-.1-.6.2l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.3-.8-.7-1.3-1.6-1.5-1.8-.2-.3 0-.4.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9 8.1Z" /></svg>
              </a>
            </nav>
          </div>
          <div className="footer-links"><strong>Find your treat</strong><a href="#shop" onClick={() => openShop("all")}>Shop everything</a><a href="#categories">Our treats</a><a href="#build">Build your own</a></div>
          <div className="footer-links"><strong>Say hello</strong><span>Contact details will be added before launch.</span><span>Made fresh, shared often.</span></div>
          <div className="newsletter"><strong>A little sweet mail?</strong><p>New treats and happy little things, now and then.</p><Newsletter onNotice={setNotice} /></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} KrunchyKremmy</span><span>Made for the moments worth savoring <span className="tiny-sun">✳</span></span><a href="#home">Back to the top ↑</a></div>
      </footer>

      {cartOpen && <CartDrawer cart={cart} total={cartTotal} onClose={() => setCartOpen(false)} onQuantity={changeQuantity} onRemove={(id) => setCart((current) => current.filter((item) => item.lineId !== id))} />}
      {builder && <BuilderModal type={builder} onClose={() => setBuilder(null)} onAdd={(item) => { addToCart(item); setBuilder(null); }} />}
      {eventBooking && <EventBookingWizard initialPackage={eventBooking} onClose={() => setEventBooking(null)} />}
      {selectedProduct && <ProductDetails product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={(quantity, customization, priceCents) => { addToCart({ ...selectedProduct, quantity, priceCents, customization }); setSelectedProduct(null); }} />}
      {accountOpen && <AccountDialog user={user} initialToken={authToken} onUser={(nextUser) => { setUser(nextUser); setAuthToken(null); if (!nextUser) setAccountOpen(false); }} onClose={() => { setAccountOpen(false); setAuthToken(null); }} />}
      {notice && <div className="toast" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </>
  );
}

function ProductCard({ product, onAdd, onView, isFavorite, onFavorite }) {
  return (
    <article className="product-card">
      <button className={`favorite-button ${isFavorite ? "is-favorite" : ""}`} aria-label={isFavorite ? `Remove ${product.name} from saved treats` : `Save ${product.name}`} aria-pressed={isFavorite} onClick={onFavorite}><Heart size={17} /></button>
      <button className="product-image" aria-label={`View ${product.name} details`} onClick={onView}>
        <img src={imageSource(product.imageUrl)} alt={product.name} loading="lazy" />
        {(product.badge || product.featured) && <span className="product-badge">{product.badge || "A little favorite"}</span>}
      </button>
      <div className="product-info">
        <div><p className="product-category">{product.categoryName || product.category?.name || "A sweet treat"}</p><h3>{product.name}</h3></div>
        <div className="product-buy"><strong>{money(product.priceCents)}</strong><button onClick={onAdd} aria-label={`Add ${product.name} to bag`}><Plus size={18} /></button></div>
      </div>
      <p className="product-description">{product.description}</p>
    </article>
  );
}

function ProductDetails({ product, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);
  const [customization, setCustomization] = useState({});
  const options = product.customizationOptions || [];
  const available = product.available !== false && (product.stock === undefined || product.stock > 0);
  const extraCents = options.reduce((total, group) => {
    const selected = customization[group.key];
    const names = Array.isArray(selected) ? selected : selected ? [selected] : [];
    return total + names.reduce((sum, name) =>
      sum + (group.choices?.find((choice) => choice.name === name)?.priceCents || 0), 0);
  }, 0);
  const missingRequired = options.some((group) => group.required && !customization[group.key]);
  function toggleChoice(group, name) {
    setCustomization((current) => {
      const selected = current[group.key];
      if (group.multiple) {
        const values = Array.isArray(selected) ? selected : [];
        return { ...current, [group.key]: values.includes(name) ? values.filter((value) => value !== name) : [...values, name] };
      }
      return { ...current, [group.key]: selected === name ? "" : name };
    });
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close product details"><X size={20} /></button>
        <img src={imageSource(product.imageUrl)} alt={product.name} />
        <div className="product-modal-copy">
          <p className="eyebrow">{product.categoryName || product.category?.name || "A sweet treat"}</p>
          <h2 id="product-title">{product.name}</h2>
          <strong>{money(product.priceCents)}</strong>
          <p>{product.description}</p>
          {options.length > 0 && <div className="product-customization">
            {options.map((group) => <fieldset key={group.key}>
              <legend>{group.label}{group.required ? " *" : ""}</legend>
              {group.type === "text" ? (
                <input maxLength={group.maxLength || 120} value={customization[group.key] || ""} onChange={(event) => setCustomization((current) => ({ ...current, [group.key]: event.target.value }))} placeholder={`Add ${group.label.toLowerCase()} (optional)`} />
              ) : <div className="product-option-list">
                {(group.choices || []).map((choice) => {
                  const selected = Array.isArray(customization[group.key])
                    ? customization[group.key].includes(choice.name)
                    : customization[group.key] === choice.name;
                  return <button type="button" className={`product-option ${selected ? "selected" : ""}`} key={choice.name} aria-pressed={selected} onClick={() => toggleChoice(group, choice.name)}>
                    {choice.name}{choice.priceCents ? ` + ${money(choice.priceCents)}` : ""}
                  </button>;
                })}
              </div>}
            </fieldset>)}
          </div>}
          <p className={available ? "stock-available" : "stock-unavailable"}>{available ? "Ready when you are" : "Currently unavailable"}</p>
          <div className="serving-control"><button aria-label="Remove one" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button><span>{quantity}</span><button aria-label="Add one" disabled={product.stock !== undefined && quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock || 20, quantity + 1))}><Plus size={15} /></button></div>
          <button className="button button-dark modal-add" disabled={!available || missingRequired} onClick={() => onAdd(quantity, customization, product.priceCents + extraCents)}>Add to your bag · {money((product.priceCents + extraCents) * quantity)} <ArrowRight size={17} /></button>
        </div>
      </section>
    </div>
  );
}

function BuilderModal({ type, onClose, onAdd }) {
  const config = builderChoices[type];
  const price = startingPrices[type];
  const [groups, setGroups] = useState(() => Object.fromEntries(
    Object.entries(config).filter(([key]) => ["base", "iceCream", "toppings", "sauces"].includes(key))
      .map(([groupKey, names]) => [groupKey, names.map((name, index) => ({
        id: `preview-${type}-${groupKey}-${index}`,
        name,
        priceCents: groupKey === "base" ? price.base + index * 100
          : groupKey === "iceCream" ? price.iceCream
            : groupKey === "toppings" ? price.toppings : price.sauces,
        maxSelections: groupKey === "base" ? 1 : groupKey === "iceCream" || groupKey === "sauces" ? 2 : 5
      }))])
  ));
  const [configured, setConfigured] = useState(false);
  const [baseId, setBaseId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [servings, setServings] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const options = Object.values(groups).flat();
  const baseOption = groups.base?.find((option) => option.id === baseId) || groups.base?.[0];
  const selectedOptions = options.filter((option) => selectedIds.includes(option.id));
  const total = (baseOption?.priceCents || 0) + selectedOptions.reduce((sum, option) => sum + option.priceCents, 0);

  useEffect(() => {
    let active = true;
    fetch(`/api/builders/${type}`)
      .then((response) => {
        if (!response.ok) throw new Error("Builder menu is unavailable.");
        return response.json();
      })
      .then((data) => {
        if (!active || !data.groups?.base?.length) return;
        setGroups(data.groups);
        setBaseId(data.groups.base[0].id);
        setSelectedIds([]);
        setConfigured(true);
      })
      .catch(() => {
        if (active) setConfigured(false);
      });
    return () => { active = false; };
  }, [type]);

  function toggle(option, groupKey) {
    const currentGroup = groups[groupKey] || [];
    const chosenInGroup = currentGroup.filter((entry) => selectedIds.includes(entry.id));
    const limit = currentGroup[0]?.maxSelections || 1;
    setSelectedIds((current) => current.includes(option.id)
      ? current.filter((id) => id !== option.id)
      : chosenInGroup.length < limit ? [...current, option.id] : current);
  }

  function optionGroup(groupKey) {
    return (groups[groupKey] || []).map((option) => (
      <OptionChip key={option.id} item={option.name} selected={selectedIds.includes(option.id)} onClick={() => toggle(option, groupKey)} />
    ));
  }

  async function submitBuilder() {
    setSubmitting(true);
    setQuoteError("");
    try {
      const optionIds = [baseOption?.id, ...selectedIds].filter(Boolean);
      let verifiedTotal = total;
      if (configured) {
        const response = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: type, optionIds })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Your selection could not be priced.");
        verifiedTotal = result.totalCents;
      }
      onAdd({
        id: `custom-${type}`, name: `${config.title.replace(/^(Build|Make|Mix) /, "")} — ${baseOption?.name || ""}`,
        priceCents: verifiedTotal, quantity: servings,
        imageUrl: type === "waffle" ? categories[1].imageUrl : type === "sundae" ? categories[0].imageUrl : type === "candy" ? categories[2].imageUrl : categories[3].imageUrl,
        customization: {
          kind: type,
          optionIds,
          displayOptions: [baseOption?.name, ...selectedOptions.map((option) => option.name)].filter(Boolean)
        }
      });
    } catch (error) {
      setQuoteError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="builder-modal" role="dialog" aria-modal="true" aria-labelledby="builder-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close builder"><X size={20} /></button>
        <div className="modal-kicker"><span>✳</span> KRUNCHYKREMMY STUDIO / {type.toUpperCase()}</div>
        <h2 id="builder-title">{config.title}<em>.</em></h2><p className="modal-intro">{config.intro}</p>
        <div className="builder-step"><div className="step-title"><span>01</span><strong>{type === "candy" ? "Choose your bag" : type === "popcorn" ? "Pick your size" : "Start with a base"}</strong></div><div className="choice-list">{(groups.base || []).map((option) => <button key={option.id} className={`choice-card ${baseOption?.id === option.id ? "selected" : ""}`} onClick={() => setBaseId(option.id)}><span>{option.name}</span><small>{money(option.priceCents)}</small></button>)}</div></div>
        {groups.iceCream?.length > 0 && <div className="builder-step"><div className="step-title"><span>02</span><strong>Choose your scoop <small>(up to {groups.iceCream[0].maxSelections})</small></strong></div><div className="option-list">{optionGroup("iceCream")}</div></div>}
        {groups.toppings?.length > 0 && <div className="builder-step"><div className="step-title"><span>{groups.iceCream?.length ? "03" : "02"}</span><strong>{type === "candy" ? "Add your candy" : type === "popcorn" ? "Add a little extra" : "Make it yours"} <small>(up to {groups.toppings[0].maxSelections})</small></strong></div><div className="option-list">{optionGroup("toppings")}</div></div>}
        {groups.sauces?.length > 0 && <div className="builder-step"><div className="step-title"><span>04</span><strong>Finish with a drizzle <small>(up to {groups.sauces[0].maxSelections})</small></strong></div><div className="option-list">{optionGroup("sauces")}</div></div>}
        {groups.extras?.length > 0 && <div className="builder-step"><div className="step-title"><span>05</span><strong>Add an extra <small>(up to {groups.extras[0].maxSelections})</small></strong></div><div className="option-list">{optionGroup("extras")}</div></div>}
        <div className="builder-review">
          <div><span className="review-label">YOUR CREATION</span><p>{[baseOption?.name, ...selectedOptions.map((option) => option.name)].filter(Boolean).join(" · ")}</p></div>
          <div className="serving-control"><button aria-label="Remove one" onClick={() => setServings(Math.max(1, servings - 1))}><Minus size={15} /></button><span>{servings}</span><button aria-label="Add one" onClick={() => setServings(Math.min(10, servings + 1))}><Plus size={15} /></button></div>
          <strong className="builder-price">{money(total * servings)}</strong>
        </div>
        <button className="button button-dark modal-add" disabled={!baseOption || submitting || (configured && !groups.base?.length)} onClick={submitBuilder}>{submitting ? "Checking your selection…" : <>Add to your bag · {money(total * servings)} <ArrowRight size={17} /></>}</button>
        {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
        <p className="estimate-note">{configured ? "Price and available options loaded from the menu service. Final totals are checked again by the server." : "Sample options and preview prices. Configure the database to load the live menu."}</p>
      </section>
    </div>
  );
}

function OptionChip({ item, selected, onClick }) {
  return <button className={`option-chip ${selected ? "selected" : ""}`} onClick={onClick}>{selected && <Check size={14} />}{item}</button>;
}

function AccountDialog({ user, initialToken, onUser, onClose }) {
  const [mode, setMode] = useState(initialToken?.type || (user ? "account" : "login"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(initialToken?.token || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/account/orders").then((response) => response.ok ? response.json() : Promise.reject(new Error("Order history is unavailable."))),
      fetch("/api/account/bookings").then((response) => response.ok ? response.json() : Promise.reject(new Error("Booking history is unavailable.")))
    ]).then(([orderResult, bookingResult]) => {
      setOrders(orderResult.orders);
      setBookings(bookingResult.bookings);
    }).catch((failure) => setError(failure.message));
  }, [user]);

  useEffect(() => {
    if (initialToken?.type !== "verify") return;
    let active = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: initialToken.token })
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Email verification failed.");
      if (active) {
        onUser(result.user);
        setMode("account");
        setMessage("Your email is verified.");
      }
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [initialToken]);

  async function retryOrderPayment(order) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/account/orders/${encodeURIComponent(order.orderNumber)}/retry-payment`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment retry could not be started.");
      if (!result.checkoutUrl) throw new Error("Secure checkout did not return a payment link.");
      window.location.assign(result.checkoutUrl);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const endpoints = {
      login: ["/api/auth/login", { email, password }],
      register: ["/api/auth/register", { name, email, password }],
      forgot: ["/api/auth/forgot-password", { email }],
      reset: ["/api/auth/reset-password", { token, password }],
      verify: ["/api/auth/verify-email", { token }]
    };
    try {
      const [url, body] = endpoints[mode];
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok) throw new Error(result.error || "The request could not be completed.");
      if (result.user) {
        onUser(result.user);
        setMode("account");
      }
      if (result.developmentToken) setToken(result.developmentToken);
      setMessage(result.message || (result.developmentToken ? "Use the development token below to continue." : ""));
      setPassword("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out.");
      onUser(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="modal-close icon-button" onClick={onClose} aria-label="Close account"><X size={20} /></button>
        {user ? <>
          <p className="eyebrow">YOUR KRUNCHYKREMMY ACCOUNT</p>
          <h2 id="account-title">Hello, {user.name}.</h2>
          <p>{user.email} · {user.emailVerified ? "Email verified" : "Email verification required"}</p>
          {user.role === "ADMIN" && <a className="text-link" href="/admin">Open staff dashboard <ArrowRight size={15} /></a>}
          <div className="account-records">
            <h3>Your orders</h3>
            {orders.length ? orders.map((order) => <article key={order.id}><strong>{order.orderNumber}</strong><span>{order.status} · {order.paymentStatus}{order.fulfillmentMethod ? ` · ${order.fulfillmentMethod.toLowerCase()}` : ""}</span><small>{order.items.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}</small>{order.scheduledStartAt && <small>{new Date(order.scheduledStartAt).toLocaleString(undefined, { timeZone: order.fulfillmentTimeZone })} · {money(order.totalCents)}</small>}{order.paymentStatus === "FAILED" && order.status === "CANCELLED" && order.fulfillmentMethod && <button className="button button-outline" disabled={busy} onClick={() => retryOrderPayment(order)}>Retry payment</button>}</article>) : <p>No account orders yet.</p>}
            <h3>Your catering requests</h3>
            {bookings.length ? bookings.map((booking) => <article key={booking.id}><strong>{booking.reference}</strong><span>{booking.status} · inquiry, not confirmed</span><small>{booking.eventType.name} · {new Date(booking.startsAt).toLocaleString()}</small></article>) : <p>No account bookings yet.</p>}
          </div>
          <button className="button button-outline" disabled={busy} onClick={logout}>Sign out</button>
        </> : <>
          <p className="eyebrow">YOUR KRUNCHYKREMMY ACCOUNT</p>
          <h2 id="account-title">{mode === "register" ? "Create your account." : mode === "forgot" ? "Reset your password." : mode === "reset" ? "Choose a new password." : mode === "verify" ? "Verify your email." : "Welcome back."}</h2>
          {["login", "register"].includes(mode) && <div className="auth-tabs"><button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</button><button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>Create account</button></div>}
          {["login", "register", "forgot", "reset"].includes(mode) && <form className="auth-form" onSubmit={submit}>
            {mode === "register" && <label>Your name<input required minLength="2" maxLength="120" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
            {["login", "register", "forgot"].includes(mode) && <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
            {["login", "register", "reset"].includes(mode) && <label>{mode === "reset" ? "New password" : "Password"}<input required type="password" minLength="12" maxLength="128" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
            {mode === "reset" && <label>Reset token<input required value={token} onChange={(event) => setToken(event.target.value)} /></label>}
            <button className="button button-dark" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}</button>
          </form>}
          {mode === "verify" && <form className="auth-form" onSubmit={submit}><label>Verification token<input required value={token} onChange={(event) => setToken(event.target.value)} /></label><button className="button button-dark" disabled={busy}>Verify email</button></form>}
          {mode === "login" && <button className="text-link" onClick={() => setMode("forgot")}>Forgot password?</button>}
          {mode === "forgot" && <button className="text-link" onClick={() => setMode("login")}>Back to sign in</button>}
          {message && <p className="form-success" role="status">{message}</p>}
          {token && mode === "register" && <label className="auth-token">Development verification token<input readOnly value={token} /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </section>
    </div>
  );
}

function CartDrawer({ cart, total, onClose, onQuantity, onRemove }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [checkoutState, setCheckoutState] = useState({ loading: false, error: "", message: "" });
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() => crypto.randomUUID());
  const [configuration, setConfiguration] = useState(null);
  const [configurationLoading, setConfigurationLoading] = useState(false);
  const [method, setMethod] = useState("PICKUP");
  const [zoneId, setZoneId] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [customer, setCustomer] = useState({
    recipientName: "", phone: "", address: "", building: "", landmark: "", instructions: "", customerNotes: ""
  });
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsRevision, setSlotsRevision] = useState(0);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const businessTimeZone = configuration?.timeZones?.[method];
  const today = new Date();
  const minimumDate = businessTimeZone
    ? dateInBusinessTimezone(businessTimeZone)
    : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    let active = true;
    setConfigurationLoading(true);
    fetch("/api/fulfillment/config")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Fulfilment options could not be loaded.");
        if (!active) return;
        setConfiguration(result);
        const selectedMethod = result.deliveryEnabled && !result.pickupEnabled ? "DELIVERY" : "PICKUP";
        setMethod(selectedMethod);
        if (result.timeZones[selectedMethod]) setDate(dateInBusinessTimezone(result.timeZones[selectedMethod]));
        if (result.deliveryZones.length) {
          setZoneId(result.deliveryZones[0].id);
          setNeighborhood(result.deliveryZones[0].neighborhoods[0] || "");
        }
      })
      .catch((error) => {
        if (active) setCheckoutState((current) => ({ ...current, error: error.message }));
      })
      .finally(() => {
        if (active) setConfigurationLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setQuote(null);
  }, [cart, email, method, zoneId, neighborhood, customer, date]);

  useEffect(() => {
    if (businessTimeZone) setDate(dateInBusinessTimezone(businessTimeZone));
  }, [businessTimeZone, method]);

  useEffect(() => {
    setSelectedSlotId("");
    setSlots([]);
  }, [method, zoneId, date]);

  useEffect(() => {
    if (!configuration || (method === "DELIVERY" && (!configuration.deliveryEnabled || !zoneId)) ||
        (method === "PICKUP" && !configuration.pickupEnabled)) return undefined;
    let active = true;
    const query = new URLSearchParams({ method, date });
    if (method === "DELIVERY") query.set("zoneId", zoneId);
    setSlotsLoading(true);
    fetch(`/api/fulfillment/slots?${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Available times could not be loaded.");
        if (active) setSlots(result.slots);
      })
      .catch((error) => {
        if (active) setCheckoutState((current) => ({ ...current, error: error.message }));
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => { active = false; };
  }, [configuration, method, zoneId, date, slotsRevision]);

  const selectedZone = configuration?.deliveryZones.find((zone) => zone.id === zoneId);
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId);
  const checkoutAvailable = Boolean(configuration?.onlinePaymentEnabled &&
    (method === "DELIVERY" ? configuration.deliveryEnabled : configuration.pickupEnabled));

  function checkoutPayload() {
    if (!selectedSlot) throw new Error("Choose an available fulfilment time.");
    const fulfillment = {
      method,
      slotStartsAt: selectedSlot.startsAt,
      slotEndsAt: selectedSlot.endsAt,
      recipientName: customer.recipientName,
      phone: customer.phone,
      customerNotes: customer.customerNotes
    };
    if (method === "DELIVERY") {
      Object.assign(fulfillment, {
        zoneId,
        neighborhood,
        address: customer.address,
        building: customer.building,
        landmark: customer.landmark,
        instructions: customer.instructions
      });
    }
    return {
      email,
      fulfillment,
      items: cart.map((item) => {
        const isBuilder = Boolean(item.customization?.kind && item.customization.optionIds);
        return {
          productId: item.id.startsWith("custom-") ? undefined : item.id,
          quantity: item.quantity,
          builder: isBuilder ? { kind: item.customization.kind, optionIds: item.customization.optionIds } : undefined,
          customization: isBuilder ? undefined : item.customization
        };
      })
    };
  }

  async function calculateQuote() {
    setQuoteLoading(true);
    setCheckoutState({ loading: false, error: "", message: "" });
    try {
      const response = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload())
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The order total could not be calculated.");
      setQuote(result);
      setCheckoutState({ loading: false, error: "", message: "Your total was calculated securely." });
    } catch (error) {
      if (/slot|fulfilment time/i.test(error.message)) {
        setSelectedSlotId("");
        setSlotsRevision((revision) => revision + 1);
      }
      setCheckoutState({ loading: false, error: error.message, message: "" });
    } finally {
      setQuoteLoading(false);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!quote) {
      setCheckoutState({ loading: false, error: "Calculate your secure order total before continuing.", message: "" });
      return;
    }
    setCheckoutState({ loading: true, error: "", message: "" });
    try {
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": checkoutIdempotencyKey },
        body: JSON.stringify(checkoutPayload())
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Checkout could not be started.");
      if (!result.checkoutUrl) throw new Error("Secure checkout did not return a payment link.");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      if (/no longer available|expired|start again/i.test(error.message)) {
        setCheckoutIdempotencyKey(crypto.randomUUID());
      }
      if (/slot|fulfilment time/i.test(error.message)) {
        setSelectedSlotId("");
        setSlotsRevision((revision) => revision + 1);
      }
      setCheckoutState({ loading: false, error: error.message, message: "" });
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-heading"><div><p className="eyebrow">The good stuff</p><h2 id="cart-title">Your bag <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2></div><button className="icon-button" onClick={onClose} aria-label="Close bag"><X size={20} /></button></div>
        {cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={28} /><h3>Room for something sweet.</h3><p>Your next favorite is just around the corner.</p><button className="button button-dark" onClick={onClose}>Keep exploring <ArrowRight size={16} /></button></div> : <>
          <div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.lineId}>
            <img src={item.imageUrl} alt="" />
            <div className="cart-item-info"><h3>{item.name}</h3>{item.customization && <p>{item.customization.displayOptions
              ? item.customization.displayOptions.join(" · ")
              : Object.entries(item.customization).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join(" · ")}</p>}<strong>{money(item.priceCents)}</strong><div className="quantity-control"><button onClick={() => onQuantity(item.lineId, -1)} aria-label="Decrease quantity"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => onQuantity(item.lineId, 1)} aria-label="Increase quantity"><Plus size={13} /></button></div></div>
            <button className="remove-item" onClick={() => onRemove(item.lineId)} aria-label={`Remove ${item.name}`}><X size={16} /></button>
          </article>)}</div>
          <div className="cart-summary"><div><span>Subtotal</span><strong>{money(quote?.subtotalCents ?? total)}</strong></div>
            {quote && <><div><span>Delivery fee</span><strong>{money(quote.deliveryFeeCents)}</strong></div><div className="checkout-total"><span>Total (NGN)</span><strong>{money(quote.totalCents)}</strong></div></>}
            {!checkoutOpen ? <button className="button button-dark checkout-button" onClick={() => setCheckoutOpen(true)}>Continue to checkout <ArrowRight size={17} /></button> : <form className="checkout-form" onSubmit={submitOrder}>
              <label htmlFor="checkout-email">Email for your order</label><input id="checkout-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              {configurationLoading ? <p>Loading delivery and pickup options…</p> : !configuration ? <p className="admin-notice">Fulfilment options are temporarily unavailable.</p> : <>
                {!configuration.deliveryEnabled && !configuration.pickupEnabled ? <p className="admin-notice">Checkout is unavailable until an administrator configures delivery or pickup schedules and service details.</p> : <>
                  <label htmlFor="fulfillment-method">Fulfilment method</label>
                  <select id="fulfillment-method" value={method} onChange={(event) => setMethod(event.target.value)}>
                    <option value="DELIVERY" disabled={!configuration.deliveryEnabled}>Home delivery{configuration.deliveryEnabled ? "" : " (not configured)"}</option>
                    <option value="PICKUP" disabled={!configuration.pickupEnabled}>Customer pickup{configuration.pickupEnabled ? "" : " (not configured)"}</option>
                  </select>
                  {method === "DELIVERY" && configuration.deliveryEnabled && <>
                    <label htmlFor="delivery-zone">Delivery zone</label>
                    <select id="delivery-zone" value={zoneId} onChange={(event) => {
                      const nextZone = configuration.deliveryZones.find((zone) => zone.id === event.target.value);
                      setZoneId(event.target.value);
                      setNeighborhood(nextZone?.neighborhoods[0] || "");
                    }}>
                      {configuration.deliveryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                    </select>
                    <label htmlFor="delivery-neighborhood">Neighbourhood</label>
                    <select id="delivery-neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)}>
                      {(selectedZone?.neighborhoods || []).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    {selectedZone && <p className="checkout-note">Estimated delivery time: about {selectedZone.estimatedDurationMinutes} minutes. The exact delivery fee is calculated in your secure order total.</p>}
                  </>}
                  <label htmlFor="fulfillment-date">Date</label>
                  <input id="fulfillment-date" type="date" min={minimumDate} value={date} onChange={(event) => setDate(event.target.value)} required />
                  <label htmlFor="fulfillment-slot">Available time</label>
                  <select id="fulfillment-slot" required value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)} disabled={slotsLoading || !slots.length}>
                    <option value="">{slotsLoading ? "Loading available times…" : slots.length ? "Choose a time" : "No available times for this date"}</option>
                    {slots.map((slot) => <option key={slot.id} value={slot.id}>{new Date(slot.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: slot.timeZone })} – {new Date(slot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: slot.timeZone })} ({slot.remainingCapacity} left)</option>)}
                  </select>
                  {method === "PICKUP" && configuration.pickupLocation && <div className="checkout-note"><strong>Pickup at {configuration.pickupLocation.name}</strong><p>{configuration.pickupLocation.address}, {configuration.pickupLocation.neighborhood}, {configuration.pickupLocation.city}, {configuration.pickupLocation.state}</p>{configuration.pickupLocation.directions && <p>Directions: {configuration.pickupLocation.directions}</p>}{configuration.pickupLocation.instructions && <p>Collection instructions: {configuration.pickupLocation.instructions}</p>}{configuration.pickupLocation.phone && <p>Contact: {configuration.pickupLocation.phone}</p>}</div>}
                  <label htmlFor="checkout-name">Your name</label><input id="checkout-name" required autoComplete="name" maxLength="120" value={customer.recipientName} onChange={(event) => setCustomer({ ...customer, recipientName: event.target.value })} />
                  <label htmlFor="checkout-phone">Phone number</label><input id="checkout-phone" required autoComplete="tel" maxLength="40" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
                  {method === "DELIVERY" && <>
                    <label htmlFor="delivery-address">Delivery address</label><input id="delivery-address" required maxLength="500" autoComplete="street-address" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} />
                    <label htmlFor="delivery-building">Apartment, floor or building (optional)</label><input id="delivery-building" maxLength="200" value={customer.building} onChange={(event) => setCustomer({ ...customer, building: event.target.value })} />
                    <label htmlFor="delivery-landmark">Nearby landmark (optional)</label><input id="delivery-landmark" maxLength="300" value={customer.landmark} onChange={(event) => setCustomer({ ...customer, landmark: event.target.value })} />
                    <label htmlFor="delivery-instructions">Delivery instructions (optional)</label><input id="delivery-instructions" maxLength="1000" value={customer.instructions} onChange={(event) => setCustomer({ ...customer, instructions: event.target.value })} />
                  </>}
                  <label htmlFor="order-notes">Order notes (optional)</label><input id="order-notes" maxLength="1000" value={customer.customerNotes} onChange={(event) => setCustomer({ ...customer, customerNotes: event.target.value })} />
                </>}
              </>}
              {configuration?.onlinePaymentEnabled && (method === "DELIVERY" ? configuration.deliveryEnabled : configuration.pickupEnabled) && <button type="button" className="button button-outline checkout-button" onClick={calculateQuote} disabled={quoteLoading || slotsLoading || !selectedSlotId}>{quoteLoading ? "Calculating…" : "Calculate secure total"}</button>}
              <button className="button button-dark checkout-button" disabled={checkoutState.loading || !checkoutAvailable || !quote}>{checkoutState.loading ? "Preparing secure checkout…" : "Continue to Paystack"} <ArrowRight size={16} /></button>
              {checkoutState.error && <p className="form-error" role="alert">{checkoutState.error}</p>}{checkoutState.message && <p className="form-success" role="status">{checkoutState.message}</p>}
            </form>}
            <p className="checkout-note">Delivery fees, slots and the payable total are confirmed by the server. No minimum order is applied.</p>
          </div>
        </>}
      </aside>
    </div>
  );
}

function Newsletter({ onNotice }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Subscription could not be saved.");
      onNotice("You're on the list. Look out for a little sweetness.");
      setEmail("");
    } catch (error) {
      onNotice(error.message);
    } finally {
      setSubmitting(false);
    }
  }
  return <form className="newsletter-form" onSubmit={submit}><label className="visually-hidden" htmlFor="newsletter-email">Your email address</label><input id="newsletter-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your email address" /><button aria-label="Subscribe to newsletter" disabled={submitting}><ArrowRight size={17} /></button><label className="newsletter-consent"><input type="checkbox" required /> I agree to receive occasional email from KrunchyKremmy.</label></form>;
}

export default App;
