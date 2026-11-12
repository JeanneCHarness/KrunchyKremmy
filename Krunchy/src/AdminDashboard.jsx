import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import ResponsiveImage from "./ResponsiveImage.jsx";

const money = (minorUnits, currency = "NGN") => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: currency.toUpperCase()
}).format(minorUnits / 100);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers }
  });
  if (response.status === 204) return null;
  const body = await response.text();
  let result = null;
  if (body) {
    try {
      result = JSON.parse(body);
    } catch {
      if (response.ok) throw new Error("The server returned an unexpected response. Please try again.");
    }
  }
  if (!response.ok) {
    const message = result?.error ||
      (response.status === 401 || response.status === 403
        ? "Please sign in with a verified staff account to continue."
        : "The request could not be completed.");
    throw new Error(message);
  }
  return result;
}

const emptyProduct = {
  name: "", slug: "", description: "", priceCents: 0, stock: 0,
  imageUrl: "", categoryId: "", featured: false, available: true, customizationOptions: []
};
const emptyAvailability = {
  timeZone: "Africa/Lagos", operatingDays: [1, 2, 3, 4, 5, 6],
  availableStartTime: "09:00", availableEndTime: "18:00",
  minimumLeadHours: 72, maximumHorizonDays: 365, maximumConcurrent: 1,
  setupBufferMinutes: 60, active: false
};
const emptyZone = {
  name: "", slug: "", description: "", neighborhoodsText: "", feeCents: "",
  estimatedDurationMinutes: "", minimumLeadMinutes: "", active: false
};
const emptyPickupLocation = {
  name: "", address: "", neighborhood: "", city: "", state: "",
  directions: "", instructions: "", phone: "", active: false
};
const emptySchedule = (method) => ({
  method, timeZone: "", operatingDays: [], startTime: "", endTime: "",
  slotDurationMinutes: "", maximumOrdersPerSlot: "", cutoffMinutes: "",
  minimumLeadMinutes: "", maximumHorizonDays: "", active: false
});
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("products");
  const [orderFilter, setOrderFilter] = useState("");
  const [fulfillmentTab, setFulfillmentTab] = useState("zones");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState(emptyAvailability);
  const [product, setProduct] = useState(emptyProduct);
  const [editingId, setEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [blackout, setBlackout] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [fulfillmentBlackout, setFulfillmentBlackout] = useState({ method: "", startsAt: "", endsAt: "", reason: "" });
  const [zones, setZones] = useState([]);
  const [zoneDraft, setZoneDraft] = useState(emptyZone);
  const [editingZoneId, setEditingZoneId] = useState("");
  const [pickupLocation, setPickupLocation] = useState(emptyPickupLocation);
  const [schedules, setSchedules] = useState({ DELIVERY: emptySchedule("DELIVERY"), PICKUP: emptySchedule("PICKUP") });
  const [blackouts, setBlackouts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reconciliationAttempts, setReconciliationAttempts] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const orderQuery = new URLSearchParams({ search, limit: "100" });
    if (orderFilter === "DELIVERY" || orderFilter === "PICKUP") orderQuery.set("fulfillmentMethod", orderFilter);
    else if (orderFilter === "PAYMENT_PENDING" || orderFilter === "PAYMENT_PAID") orderQuery.set("paymentStatus", orderFilter.slice("PAYMENT_".length));
    else if (orderFilter) orderQuery.set("status", orderFilter);
    const [categoryResult, productResult, orderResult, bookingResult, availabilityResult, zoneResult, pickupResult, scheduleResult, notificationResult, reconciliationResult] = await Promise.all([
      api("/api/admin/categories"),
      api(`/api/admin/products?search=${encodeURIComponent(search)}`),
      api(`/api/admin/orders?${orderQuery}`),
      api(`/api/admin/bookings?search=${encodeURIComponent(search)}`),
      api("/api/admin/availability"),
      api("/api/admin/fulfillment/zones"),
      api("/api/admin/fulfillment/pickup-location"),
      api("/api/admin/fulfillment/schedules"),
      api("/api/admin/order-notifications"),
      api("/api/admin/payments/reconciliation")
    ]);
    setCategories(categoryResult.categories);
    setProducts(productResult.products);
    setOrders(orderResult.orders);
    setBookings(bookingResult.bookings);
    setAvailability(availabilityResult.availability.find((item) => item.scope === "default") || emptyAvailability);
    setZones(zoneResult.zones);
    if (pickupResult.pickupLocation) setPickupLocation(pickupResult.pickupLocation);
    const loadedSchedules = { DELIVERY: emptySchedule("DELIVERY"), PICKUP: emptySchedule("PICKUP") };
    for (const schedule of scheduleResult.schedules) loadedSchedules[schedule.method] = schedule;
    setSchedules(loadedSchedules);
    setBlackouts(scheduleResult.blackouts);
    setNotifications(notificationResult.notifications);
    setReconciliationAttempts(reconciliationResult.attempts);
  }, [search, orderFilter]);

  useEffect(() => {
    api("/api/auth/me").then((result) => {
      const current = result?.user;
      if (!current) throw new Error("Please sign in with a verified staff account to continue.");
      setUser(current);
      setAuthorized(current.role === "ADMIN");
      if (current.role === "ADMIN") load().catch((failure) => setError(failure.message));
    }).catch((failure) => setError(failure.message));
  }, [load]);

  async function perform(action, successMessage) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(typeof successMessage === "function" ? successMessage(result) : successMessage);
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function editProduct(item) {
    setEditingId(item.id);
    setProduct({
      name: item.name, slug: item.slug, description: item.description,
      priceCents: item.priceCents, stock: item.stock, imageUrl: item.imageUrl,
      categoryId: item.categoryId, featured: item.featured, available: item.available,
      customizationOptions: item.customizationOptions || []
    });
  }

  async function saveProduct(event) {
    event.preventDefault();
    let customizationOptions;
    try {
      customizationOptions = JSON.parse(product.optionsText || "[]");
      if (!Array.isArray(customizationOptions)) throw new Error("Options must be a JSON array.");
    } catch (failure) {
      setError(`Customization options: ${failure.message}`);
      return;
    }
    const data = { ...product, customizationOptions };
    delete data.optionsText;
    await perform(async () => {
      await api(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(data)
      });
      setEditingId("");
      setProduct(emptyProduct);
    }, editingId ? "Product updated." : "Product created.");
  }

  function editZone(zone) {
    setEditingZoneId(zone.id);
    setZoneDraft({
      name: zone.name,
      slug: zone.slug,
      description: zone.description,
      neighborhoodsText: zone.neighborhoods.join(", "),
      feeCents: zone.feeCents,
      estimatedDurationMinutes: zone.estimatedDurationMinutes,
      minimumLeadMinutes: zone.minimumLeadMinutes,
      active: zone.active
    });
  }

  async function saveZone(event) {
    event.preventDefault();
    const data = {
      name: zoneDraft.name,
      slug: zoneDraft.slug,
      description: zoneDraft.description,
      neighborhoods: zoneDraft.neighborhoodsText.split(",").map((item) => item.trim()).filter(Boolean),
      feeCents: Number(zoneDraft.feeCents),
      estimatedDurationMinutes: Number(zoneDraft.estimatedDurationMinutes),
      minimumLeadMinutes: Number(zoneDraft.minimumLeadMinutes),
      active: zoneDraft.active
    };
    await perform(async () => {
      await api(editingZoneId ? `/api/admin/fulfillment/zones/${editingZoneId}` : "/api/admin/fulfillment/zones", {
        method: editingZoneId ? "PATCH" : "POST",
        body: JSON.stringify(data)
      });
      setEditingZoneId("");
      setZoneDraft(emptyZone);
    }, editingZoneId ? "Delivery zone updated." : "Delivery zone created.");
  }

  async function savePickupLocation(event) {
    event.preventDefault();
    const data = Object.fromEntries(
      ["name", "address", "neighborhood", "city", "state", "directions", "instructions", "phone", "active"]
        .map((field) => [field, pickupLocation[field] ?? null])
    );
    await perform(() => api("/api/admin/fulfillment/pickup-location", {
      method: "PUT",
      body: JSON.stringify(data)
    }), "Pickup location saved.");
  }

  async function saveSchedule(event, method) {
    event.preventDefault();
    const data = Object.fromEntries(
      ["timeZone", "operatingDays", "startTime", "endTime", "slotDurationMinutes", "maximumOrdersPerSlot",
        "cutoffMinutes", "minimumLeadMinutes", "maximumHorizonDays", "active"]
        .map((field) => [field, schedules[method][field]])
    );
    for (const field of ["slotDurationMinutes", "maximumOrdersPerSlot", "cutoffMinutes", "minimumLeadMinutes", "maximumHorizonDays"]) {
      data[field] = Number(data[field]);
    }
    await perform(() => api(`/api/admin/fulfillment/schedules/${method}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }), `${method === "DELIVERY" ? "Delivery" : "Pickup"} schedule saved.`);
  }

  function toBusinessTimeIso(date, time, timeZone) {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = target;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date(timestamp));
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
      const difference = target - represented;
      timestamp += difference;
      if (!difference) break;
    }
    return new Date(timestamp).toISOString();
  }

  async function saveBlackout(event) {
    event.preventDefault();
    const method = fulfillmentBlackout.method || null;
    const selectedTimeZone = method
      ? schedules[method].timeZone
      : schedules.DELIVERY.timeZone || schedules.PICKUP.timeZone;
    if (!selectedTimeZone) {
      setError("Configure a business timezone before adding blackout dates.");
      return;
    }
    if (!method && schedules.DELIVERY.timeZone && schedules.PICKUP.timeZone &&
        schedules.DELIVERY.timeZone !== schedules.PICKUP.timeZone) {
      setError("Choose a fulfilment method because delivery and pickup use different timezones.");
      return;
    }
    try {
      const nextDay = new Date(`${fulfillmentBlackout.endsAt}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const endDate = nextDay.toISOString().slice(0, 10);
      await perform(async () => {
        const result = await api("/api/admin/fulfillment/blackouts", {
          method: "POST",
          body: JSON.stringify({
            method,
            startsAt: toBusinessTimeIso(fulfillmentBlackout.startsAt, "00:00", selectedTimeZone),
            endsAt: toBusinessTimeIso(endDate, "00:00", selectedTimeZone),
            reason: fulfillmentBlackout.reason
          })
        });
        setFulfillmentBlackout({ method: "", startsAt: "", endsAt: "", reason: "" });
        return result;
      }, "Blackout date added.");
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function updateBookingStatus(booking, status) {
    await perform(() => api(`/api/admin/bookings/${booking.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: `Staff updated request from ${booking.status} to ${status}.` })
    }), `Booking ${booking.reference} updated.`);
  }

  async function createQuotation(booking) {
    const amount = window.prompt(`Quotation total in kobo for ${booking.reference}:`);
    if (amount === null) return;
    const amountCents = Number(amount);
    const description = window.prompt("Description for this quotation line:");
    if (description === null) return;
    await perform(() => api(`/api/admin/bookings/${booking.id}/quotations`, {
        method: "POST",
        body: JSON.stringify({ amountCents, currency: booking.currency || "ngn", items: [{ description, amountCents }] })
      }),
      (result) => result.emailSent
        ? "Quotation saved and email sent."
        : "Quotation saved, but email was not delivered. Configure Resend and contact the customer.");
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  if (!authorized) {
    return <main className="admin-shell"><section className="admin-card">
      <a href="/" className="text-link"><ArrowLeft size={15} /> Return to the storefront</a>
      <h1>Staff sign-in required</h1>
      <p>{user ? "This account does not have administrator access." : error || "Sign in with a verified staff account to continue."}</p>
      {!user && <a className="button button-dark" href="/">Go to sign in</a>}
    </section></main>;
  }

  return (
    <main className="admin-shell">
      <header className="admin-header"><div><a href="/" className="text-link"><ArrowLeft size={15} /> Storefront</a><h1>KrunchyKremmy staff</h1><p>Signed in as {user.email}</p></div><div><button className="button button-outline" onClick={() => load().catch((failure) => setError(failure.message))}><RefreshCw size={15} /> Refresh</button><button className="button button-dark" onClick={signOut}>Sign out</button></div></header>
      <nav className="admin-tabs">{["products", "categories", "orders", "bookings", "availability", "fulfillment"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "fulfillment" ? "Delivery & fulfilment" : item}</button>)}</nav>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!["availability", "fulfillment"].includes(tab) && <label className="admin-search">Search records<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, order number, email, or booking reference" /></label>}

      {tab === "products" && <section className="admin-grid">
        <form className="admin-card admin-form" onSubmit={saveProduct}>
          <h2>{editingId ? "Edit product" : "Add product"}</h2>
          <label>Name<input required value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label>
          <label>URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={product.slug} onChange={(event) => setProduct({ ...product, slug: event.target.value })} /></label>
          <label>Description<textarea required value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
          <label>Price (kobo)<input required type="number" min="0" value={product.priceCents} onChange={(event) => setProduct({ ...product, priceCents: Number(event.target.value) })} /></label>
          <label>Stock<input required type="number" min="0" value={product.stock} onChange={(event) => setProduct({ ...product, stock: Number(event.target.value) })} /></label>
          <label>Category<select required value={product.categoryId} onChange={(event) => setProduct({ ...product, categoryId: event.target.value })}><option value="">Select a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Image URL or public path<input required value={product.imageUrl} onChange={(event) => setProduct({ ...product, imageUrl: event.target.value })} /></label>
          <label>Customization options (JSON)<textarea rows="7" value={product.optionsText ?? JSON.stringify(product.customizationOptions, null, 2)} onChange={(event) => setProduct({ ...product, optionsText: event.target.value })} /></label>
          <label className="admin-check"><input type="checkbox" checked={product.available} onChange={(event) => setProduct({ ...product, available: event.target.checked })} /> Available</label>
          <label className="admin-check"><input type="checkbox" checked={product.featured} onChange={(event) => setProduct({ ...product, featured: event.target.checked })} /> Featured</label>
          <div className="admin-actions"><button className="button button-dark" disabled={busy}><Save size={15} /> Save product</button>{editingId && <button type="button" className="button button-outline" onClick={() => { setEditingId(""); setProduct(emptyProduct); }}>Cancel</button>}</div>
        </form>
        <div className="admin-card"><h2>Products ({products.length})</h2><div className="admin-list">{products.map((item) => <article key={item.id}><ResponsiveImage src={item.imageUrl} alt="" sizes="54px" /><div><strong>{item.name}</strong><span>{item.category.name} · {item.priceCents} · stock {item.stock}</span><small>{item.available ? "Available" : "Inactive"}{item.featured ? " · Featured" : ""}</small></div><div className="admin-actions"><button className="button button-outline" onClick={() => editProduct(item)}>Edit</button><button className="button button-outline" onClick={() => perform(() => api(`/api/admin/products/${item.id}`, { method: "PATCH", body: JSON.stringify({ available: !item.available }) }), item.available ? "Product deactivated." : "Product activated.")}>{item.available ? "Deactivate" : "Activate"}</button></div></article>)}</div></div>
      </section>}

      {tab === "categories" && <section className="admin-card"><h2>Categories</h2><CategoryEditor categories={categories} busy={busy} onSave={(data) => perform(() => api(data.id ? `/api/admin/categories/${data.id}` : "/api/admin/categories", { method: data.id ? "PATCH" : "POST", body: JSON.stringify(data.values) }), data.id ? "Category updated." : "Category created.")} /></section>}

      {tab === "orders" && <section className="admin-card"><h2>Orders ({orders.length})</h2><label className="admin-search">Filter orders<select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="">All orders</option><option value="DELIVERY">Home delivery</option><option value="PICKUP">Customer pickup</option><option value="PAYMENT_PENDING">Pending payment</option><option value="PAYMENT_PAID">Paid</option>{["PAYMENT_REVIEW", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COLLECTED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label><div className="admin-list">{orders.map((order) => {
        const next = {
          CONFIRMED: "PREPARING",
          PREPARING: order.fulfillmentMethod === "PICKUP" ? "READY_FOR_PICKUP" : order.fulfillmentMethod === "DELIVERY" ? "OUT_FOR_DELIVERY" : "READY",
          READY: "COMPLETED",
          READY_FOR_PICKUP: "COLLECTED",
          OUT_FOR_DELIVERY: "DELIVERED"
        }[order.status];
        const address = order.fulfillmentMethod === "DELIVERY"
          ? [order.deliveryAddress, order.deliveryBuilding, order.deliveryNeighborhood, order.deliveryZoneName].filter(Boolean).join(", ")
          : order.pickupLocationAddress || order.pickupLocationName;
        const slot = order.scheduledStartAt
          ? `${new Date(order.scheduledStartAt).toLocaleString(undefined, { timeZone: order.fulfillmentTimeZone })} – ${new Date(order.scheduledEndAt).toLocaleTimeString(undefined, { timeZone: order.fulfillmentTimeZone })}`
          : "No scheduled slot";
        return <article className="admin-record" key={order.id}><div>
          <strong>{order.orderNumber}</strong>
          <span>{order.email} · {order.fulfillmentMethod || "Legacy order"} · {order.paymentStatus} · {order.status}</span>
          <small>{order.items.map((item) => `${item.quantity} × ${item.productName}${item.customization ? ` (${JSON.stringify(item.customization)})` : ""}`).join(" | ")}</small>
          <small>Customer: {order.recipientName || "—"} · {order.recipientPhone || "—"}</small>
          {address && <small>{order.fulfillmentMethod === "DELIVERY" ? "Deliver to" : "Pickup at"}: {address}</small>}
          <small>Scheduled: {slot} · fee {money(order.deliveryFeeCents, order.currency)} · total {money(order.totalCents, order.currency)}</small>
          {order.customerNotes && <small>Order notes: {order.customerNotes}</small>}
          {order.assignedRiderName && <small>Rider: {order.assignedRiderName} · {order.riderContact || "no contact"}</small>}
          {order.dispatchNotes && <small>Dispatch notes: {order.dispatchNotes}</small>}
          {order.trackingReference && <small>Tracking: {order.trackingReference}</small>}
          {order.dispatchedAt && <small>Dispatched: {new Date(order.dispatchedAt).toLocaleString()}</small>}
          {order.completedAt && <small>Completed: {new Date(order.completedAt).toLocaleString()}</small>}
          <small>Created: {new Date(order.createdAt).toLocaleString()}</small>
        </div>
          {order.fulfillmentMethod === "DELIVERY" && <button className="button button-outline" disabled={busy} onClick={() => {
            const assignedRiderName = window.prompt("Assigned rider name:", order.assignedRiderName || "");
            if (assignedRiderName === null) return;
            const riderContact = window.prompt("Rider contact:", order.riderContact || "");
            if (riderContact === null) return;
            const trackingReference = window.prompt("Tracking reference:", order.trackingReference || "");
            if (trackingReference === null) return;
            const dispatchNotes = window.prompt("Dispatch notes:", order.dispatchNotes || "");
            if (dispatchNotes === null) return;
            perform(() => api(`/api/admin/orders/${order.id}/dispatch`, {
              method: "PATCH",
              body: JSON.stringify({ assignedRiderName, riderContact, trackingReference, dispatchNotes })
            }), "Delivery details updated.");
          }}>Dispatch details</button>}
        </article>;
      })}</div></section>}

      {tab === "fulfillment" && <>
        <nav className="admin-tabs" aria-label="Fulfilment settings">
          {["zones", "pickup", "scheduling", "notifications"].map((item) => <button key={item} className={fulfillmentTab === item ? "active" : ""} onClick={() => setFulfillmentTab(item)}>{item === "pickup" ? "Pickup location" : item}</button>)}
        </nav>
        <p className="admin-notice">Nothing is enabled by default. Configure actual business details and explicitly activate service before customer checkout becomes available.</p>
        {fulfillmentTab === "zones" && <section className="admin-grid">
          <form className="admin-card admin-form" onSubmit={saveZone}>
            <h2>{editingZoneId ? "Edit delivery zone" : "Create delivery zone"}</h2>
            <label>Zone name<input required maxLength="120" value={zoneDraft.name} onChange={(event) => setZoneDraft({ ...zoneDraft, name: event.target.value })} /></label>
            <label>Unique URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="140" value={zoneDraft.slug} onChange={(event) => setZoneDraft({ ...zoneDraft, slug: event.target.value })} /></label>
            <label>Description<input maxLength="1000" value={zoneDraft.description} onChange={(event) => setZoneDraft({ ...zoneDraft, description: event.target.value })} /></label>
            <label>Supported neighbourhoods (comma-separated)<textarea required rows="3" value={zoneDraft.neighborhoodsText} onChange={(event) => setZoneDraft({ ...zoneDraft, neighborhoodsText: event.target.value })} /></label>
            <label>Delivery fee (kobo)<input required type="number" min="0" max="100000000" value={zoneDraft.feeCents} onChange={(event) => setZoneDraft({ ...zoneDraft, feeCents: event.target.value })} /></label>
            <label>Estimated delivery duration (minutes)<input required type="number" min="1" max="10080" value={zoneDraft.estimatedDurationMinutes} onChange={(event) => setZoneDraft({ ...zoneDraft, estimatedDurationMinutes: event.target.value })} /></label>
            <label>Minimum delivery lead time (minutes)<input required type="number" min="0" max="10080" value={zoneDraft.minimumLeadMinutes} onChange={(event) => setZoneDraft({ ...zoneDraft, minimumLeadMinutes: event.target.value })} /></label>
            <label className="admin-check"><input type="checkbox" checked={zoneDraft.active} onChange={(event) => setZoneDraft({ ...zoneDraft, active: event.target.checked })} /> Active for checkout</label>
            <div className="admin-actions"><button className="button button-dark" disabled={busy}><Save size={15} /> Save zone</button>{editingZoneId && <button type="button" className="button button-outline" onClick={() => { setEditingZoneId(""); setZoneDraft(emptyZone); }}>Cancel</button>}</div>
          </form>
          <section className="admin-card"><h2>Delivery zones ({zones.length})</h2><div className="admin-list">{zones.map((zone) => <article className="admin-record" key={zone.id}><div><strong>{zone.name} · {zone.active ? "Active" : "Inactive"}</strong><span>{zone.neighborhoods.join(", ")}</span><small>{money(zone.feeCents)} fee · approx. {zone.estimatedDurationMinutes} minutes · {zone._count.orders} historical orders</small></div><div className="admin-actions"><button className="button button-outline" disabled={busy} onClick={() => editZone(zone)}>Edit</button><button className="button button-outline" disabled={busy} onClick={() => perform(() => api(`/api/admin/fulfillment/zones/${zone.id}`, { method: "PATCH", body: JSON.stringify({ active: !zone.active }) }), zone.active ? "Delivery zone deactivated." : "Delivery zone activated.")}>{zone.active ? "Deactivate" : "Activate"}</button><button className="button button-outline" disabled={busy || zone._count.orders > 0} title={zone._count.orders ? "Historical orders exist; deactivate instead." : "Delete unused zone"} onClick={() => perform(() => api(`/api/admin/fulfillment/zones/${zone.id}`, { method: "DELETE" }), "Delivery zone deleted.")}>Delete</button></div></article>)}</div></section>
        </section>}
        {fulfillmentTab === "pickup" && <form className="admin-card admin-form" onSubmit={savePickupLocation}>
          <h2>Fixed pickup location</h2>
          <p className="admin-notice">Only one pickup location is supported. Existing orders keep their saved location snapshot when this setting changes.</p>
          <label>Business / pickup name<input required maxLength="120" value={pickupLocation.name} onChange={(event) => setPickupLocation({ ...pickupLocation, name: event.target.value })} /></label>
          <label>Full address<input required maxLength="500" value={pickupLocation.address} onChange={(event) => setPickupLocation({ ...pickupLocation, address: event.target.value })} /></label>
          <label>Neighbourhood<input required maxLength="120" value={pickupLocation.neighborhood} onChange={(event) => setPickupLocation({ ...pickupLocation, neighborhood: event.target.value })} /></label>
          <label>City<input required maxLength="120" value={pickupLocation.city} onChange={(event) => setPickupLocation({ ...pickupLocation, city: event.target.value })} /></label>
          <label>State<input required maxLength="120" value={pickupLocation.state} onChange={(event) => setPickupLocation({ ...pickupLocation, state: event.target.value })} /></label>
          <label>Directions and landmarks<textarea rows="3" maxLength="1000" value={pickupLocation.directions || ""} onChange={(event) => setPickupLocation({ ...pickupLocation, directions: event.target.value })} /></label>
          <label>Customer collection instructions<textarea rows="3" maxLength="1000" value={pickupLocation.instructions || ""} onChange={(event) => setPickupLocation({ ...pickupLocation, instructions: event.target.value })} /></label>
          <label>Contact phone<input maxLength="40" value={pickupLocation.phone || ""} onChange={(event) => setPickupLocation({ ...pickupLocation, phone: event.target.value })} /></label>
          <label className="admin-check"><input type="checkbox" checked={pickupLocation.active} onChange={(event) => setPickupLocation({ ...pickupLocation, active: event.target.checked })} /> Active for checkout</label>
          <button className="button button-dark" disabled={busy}><Save size={15} /> Save pickup location</button>
        </form>}
        {fulfillmentTab === "scheduling" && <div className="admin-grid">
          {["DELIVERY", "PICKUP"].map((method) => {
            const schedule = schedules[method];
            const update = (field, value) => setSchedules((current) => ({ ...current, [method]: { ...current[method], [field]: value } }));
            return <form className="admin-card admin-form" key={method} onSubmit={(event) => saveSchedule(event, method)}>
              <h2>{method === "DELIVERY" ? "Delivery schedule" : "Pickup schedule"}</h2>
              <label>Business timezone (IANA)<input required placeholder="Configure business timezone" value={schedule.timeZone} onChange={(event) => update("timeZone", event.target.value)} /></label>
              <fieldset className="admin-days"><legend>Operating days</legend>{weekdays.map((day, index) => <label className="admin-check" key={day}><input type="checkbox" checked={schedule.operatingDays.includes(index)} onChange={(event) => update("operatingDays", event.target.checked ? [...schedule.operatingDays, index].sort() : schedule.operatingDays.filter((item) => item !== index))} /> {day}</label>)}</fieldset>
              <label>Opening time<input required type="time" value={schedule.startTime} onChange={(event) => update("startTime", event.target.value)} /></label>
              <label>Closing time<input required type="time" value={schedule.endTime} onChange={(event) => update("endTime", event.target.value)} /></label>
              <label>Time-slot duration (minutes)<input required type="number" min="5" max="1440" value={schedule.slotDurationMinutes} onChange={(event) => update("slotDurationMinutes", event.target.value)} /></label>
              <label>Maximum orders per slot<input required type="number" min="1" max="10000" value={schedule.maximumOrdersPerSlot} onChange={(event) => update("maximumOrdersPerSlot", event.target.value)} /></label>
              <label>Order cut-off before slot (minutes)<input required type="number" min="0" max="10080" value={schedule.cutoffMinutes} onChange={(event) => update("cutoffMinutes", event.target.value)} /></label>
              <label>Minimum scheduling lead time (minutes)<input required type="number" min="0" max="10080" value={schedule.minimumLeadMinutes} onChange={(event) => update("minimumLeadMinutes", event.target.value)} /></label>
              <label>Maximum advance booking horizon (days)<input required type="number" min="1" max="365" value={schedule.maximumHorizonDays} onChange={(event) => update("maximumHorizonDays", event.target.value)} /></label>
              <label className="admin-check"><input type="checkbox" checked={schedule.active} onChange={(event) => update("active", event.target.checked)} /> Enable this schedule</label>
              <button className="button button-dark" disabled={busy}><Save size={15} /> Save {method.toLowerCase()} schedule</button>
            </form>;
          })}
          <section className="admin-card admin-form">
            <h2>Blackout dates</h2>
            <form className="admin-form" onSubmit={saveBlackout}>
              <label>Applies to<select value={fulfillmentBlackout.method} onChange={(event) => setFulfillmentBlackout({ ...fulfillmentBlackout, method: event.target.value })}><option value="">Delivery and pickup</option><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></select></label>
              <label>Start date<input required type="date" value={fulfillmentBlackout.startsAt} onChange={(event) => setFulfillmentBlackout({ ...fulfillmentBlackout, startsAt: event.target.value })} /></label>
              <label>End date (inclusive)<input required type="date" min={fulfillmentBlackout.startsAt} value={fulfillmentBlackout.endsAt} onChange={(event) => setFulfillmentBlackout({ ...fulfillmentBlackout, endsAt: event.target.value })} /></label>
              <label>Reason (optional)<input maxLength="500" value={fulfillmentBlackout.reason} onChange={(event) => setFulfillmentBlackout({ ...fulfillmentBlackout, reason: event.target.value })} /></label>
              <button className="button button-dark" disabled={busy}>Add blackout</button>
            </form>
            <div className="admin-list">{blackouts.map((item) => <article key={item.id}><div><strong>{item.method || "Delivery and pickup"}</strong><span>{new Date(item.startsAt).toLocaleString()} – {new Date(item.endsAt).toLocaleString()}</span><small>{item.reason || "No reason provided"}</small></div><button className="button button-outline" disabled={busy} onClick={() => perform(() => api(`/api/admin/fulfillment/blackouts/${item.id}`, { method: "DELETE" }), "Blackout removed.")}>Remove</button></article>)}</div>
          </section>
        </div>}
        {fulfillmentTab === "notifications" && <section className="admin-card">
          <h2>Order email notifications</h2>
          <p className="admin-notice">Delivery failures are recorded and do not roll back paid orders. Notifications in progress for over ten minutes can be retried.</p>
          <h3>Payment reconciliation ({reconciliationAttempts.length})</h3>
          {reconciliationAttempts.length ? <div className="admin-list">{reconciliationAttempts.map((attempt) => <article key={attempt.id}><div><strong>{attempt.order.orderNumber} · {attempt.status}</strong><span>{attempt.reference} · {money(attempt.amountKobo, attempt.currency)}</span><small>{attempt.order.email} · {attempt.order.status} · manual review required</small></div></article>)}</div> : <p>No payments need reconciliation.</p>}
          <h3>Email delivery ({notifications.length})</h3>
          {notifications.length ? <div className="admin-list">{notifications.map((item) => <article className="admin-record" key={item.id}><div><strong>{item.order.orderNumber} · {item.type}</strong><span>{item.order.email} · {item.status} · attempts {item.attempts}</span><small>{item.lastError || "Delivery is pending."}</small></div><button className="button button-outline" disabled={busy || item.status === "SENDING"} onClick={() => perform(
            () => api(`/api/admin/order-notifications/${item.id}/retry`, { method: "POST" }),
            (result) => result.notification.status === "SENT" ? "Notification sent." : `Notification remains ${result.notification.status.toLowerCase()}.`
          )}>Retry</button></article>)}</div> : <p>No pending or failed notifications.</p>}
        </section>}
      </>}

      {tab === "bookings" && <section className="admin-card"><h2>Event requests ({bookings.length})</h2><p className="admin-notice">Confirmation is disabled until availability, customer acceptance, and deposit/payment requirements can be verified. Requests remain unconfirmed.</p><div className="admin-list">{bookings.map((booking) => <article className="admin-record" key={booking.id}><div><strong>{booking.reference} · {booking.status}</strong><span>{booking.customerName} · {booking.customerEmail} · {booking.customerPhone}</span><small>{booking.eventType.name} · {new Date(booking.startsAt).toLocaleString()}–{new Date(booking.endsAt).toLocaleTimeString()} · {booking.guestCount} guests · {booking.city}</small><small>{booking.services.map((service) => `${service.serviceName} (${service.servings})`).join(", ")}</small>{booking.quotations.map((quote) => <small key={quote.id}>Quote v{quote.version}: {money(quote.amountCents, quote.currency)} · deposit {quote.depositCents === null ? "none" : money(quote.depositCents, quote.currency)} · expires {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "not set"}</small>)}</div><div className="admin-actions"><select aria-label={`Update status for ${booking.reference}`} value="" onChange={(event) => { if (event.target.value) updateBookingStatus(booking, event.target.value); }}><option value="">Change status</option>{["UNDER_REVIEW", "AWAITING_CUSTOMER_APPROVAL", "AWAITING_DEPOSIT", "IN_PREPARATION", "COMPLETED", "CANCELLATION_REQUESTED", "CANCELLED", "DECLINED"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="button button-outline" onClick={() => createQuotation(booking)}>Create quote</button></div></article>)}</div></section>}

      {tab === "availability" && <section className="admin-grid"><form className="admin-card admin-form" onSubmit={(event) => { event.preventDefault(); perform(() => api("/api/admin/availability", { method: "PUT", body: JSON.stringify(availability) }), "Availability rules saved."); }}><h2>Booking availability rules</h2><label>Business time zone<input required value={availability.timeZone} onChange={(event) => setAvailability({ ...availability, timeZone: event.target.value })} /></label><label>Open time<input required type="time" value={availability.availableStartTime} onChange={(event) => setAvailability({ ...availability, availableStartTime: event.target.value })} /></label><label>Close time<input required type="time" value={availability.availableEndTime} onChange={(event) => setAvailability({ ...availability, availableEndTime: event.target.value })} /></label><label>Operating days (0 Sunday–6 Saturday)<input required value={availability.operatingDays.join(",")} onChange={(event) => setAvailability({ ...availability, operatingDays: event.target.value.split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) })} /></label><label>Minimum lead time (hours)<input type="number" min="0" value={availability.minimumLeadHours} onChange={(event) => setAvailability({ ...availability, minimumLeadHours: Number(event.target.value) })} /></label><label>Maximum horizon (days)<input type="number" min="1" value={availability.maximumHorizonDays} onChange={(event) => setAvailability({ ...availability, maximumHorizonDays: Number(event.target.value) })} /></label><label>Maximum concurrent events<input type="number" min="1" value={availability.maximumConcurrent} onChange={(event) => setAvailability({ ...availability, maximumConcurrent: Number(event.target.value) })} /></label><label>Setup buffer (minutes)<input type="number" min="0" value={availability.setupBufferMinutes} onChange={(event) => setAvailability({ ...availability, setupBufferMinutes: Number(event.target.value) })} /></label><label className="admin-check"><input type="checkbox" checked={availability.active} onChange={(event) => setAvailability({ ...availability, active: event.target.checked })} /> Enable availability checks</label><button className="button button-dark" disabled={busy}>Save availability</button></form>
        <form className="admin-card admin-form" onSubmit={(event) => { event.preventDefault(); perform(() => api("/api/admin/blackouts", { method: "POST", body: JSON.stringify({ ...blackout, startsAt: new Date(blackout.startsAt).toISOString(), endsAt: new Date(blackout.endsAt).toISOString() }) }), "Blackout date saved."); }}><h2>Block out dates</h2><label>Starts<input required type="datetime-local" value={blackout.startsAt} onChange={(event) => setBlackout({ ...blackout, startsAt: event.target.value })} /></label><label>Ends<input required type="datetime-local" value={blackout.endsAt} onChange={(event) => setBlackout({ ...blackout, endsAt: event.target.value })} /></label><label>Reason<input value={blackout.reason} onChange={(event) => setBlackout({ ...blackout, reason: event.target.value })} /></label><button className="button button-dark" disabled={busy}>Add blackout</button></form>
      </section>}
    </main>
  );
}

function CategoryEditor({ categories, busy, onSave }) {
  const [draft, setDraft] = useState({ name: "", slug: "", description: "", imageUrl: "" });
  return <><form className="admin-inline-form" onSubmit={(event) => { event.preventDefault(); onSave({ values: draft }); setDraft({ name: "", slug: "", description: "", imageUrl: "" }); }}><input required placeholder="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><input required placeholder="slug" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /><input required placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /><input required placeholder="Image URL" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} /><button className="button button-dark" disabled={busy}>Add</button></form><div className="admin-list">{categories.map((category) => <article key={category.id}><ResponsiveImage src={category.imageUrl} alt="" sizes="54px" /><div><strong>{category.name}</strong><span>{category.slug} · {category.active ? "Active" : "Inactive"}</span><small>{category.description}</small></div><button className="button button-outline" onClick={() => onSave({ id: category.id, values: { active: !category.active } })}>{category.active ? "Deactivate" : "Activate"}</button></article>)}</div></>;
}
