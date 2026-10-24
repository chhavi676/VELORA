import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/auth.jsx";
import { money, formatDate, stockLabel, productHref } from "../lib/format.js";
import * as api from "../services/api.js";

const ROLE_TABS = {
  admin: [["overview", "Overview"], ["orders", "All orders"], ["products", "Products"], ["users", "Users & roles"], ["my-orders", "My orders"]],
  designer: [["products", "My products"], ["my-orders", "My orders"]],
  model: [["portfolio", "Portfolio"], ["my-orders", "My orders"]],
  customer: [["my-orders", "My orders"]]
};
const ROLE_BLURB = {
  admin: "You can see store-wide numbers, manage every order and product, and assign roles.",
  designer: "You can create and edit your own products. You cannot see other designers’ products or any orders.",
  model: "Model accounts have their own area. Store management is not available to this role.",
  customer: "Track your orders and cancel them before they ship."
};
const STATUSES = ["placed", "confirmed", "shipped", "delivered", "cancelled"];

function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return fn().then((data) => setState({ data, error: "", loading: false })).catch((e) => setState({ data: null, error: e.message, loading: false }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })) };
}

const Status = ({ value }) => <span className={`status-pill s-${value}`}>{value}</span>;
const Err = ({ children }) => (children ? <p className="form-error" role="alert">{children}</p> : null);

export default function Dashboard({ tab, notify }) {
  const { session, profile, loading, error, signOut } = useAuth();

  if (loading) return <section className="page-shell"><p className="page-muted">Loading your account…</p></section>;
  if (!session || !profile) {
    return <section className="page-shell narrow"><p className="eyebrow">YOUR VÉLORA</p><h1 className="page-title">Please sign in.</h1>{error && <Err>{error}</Err>}<div className="page-actions"><a className="solid-link" href="#account">SIGN IN</a></div></section>;
  }
  const tabs = ROLE_TABS[profile.role] || ROLE_TABS.customer;
  const active = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];

  return <section className="page-shell dashboard">
    <div className="dash-head">
      <div>
        <p className="eyebrow">{profile.role.toUpperCase()} DASHBOARD</p>
        <h1 className="page-title">Hello, {(profile.fullName || profile.email).split(" ")[0]}.</h1>
        <p className="page-muted">{ROLE_BLURB[profile.role]}</p>
      </div>
      <button className="outline-button" onClick={signOut}>SIGN OUT</button>
    </div>
    <nav className="dash-tabs" aria-label="Dashboard sections">{tabs.map(([key, label]) => <a key={key} href={`#/dashboard/${key}`} className={key === active ? "active" : ""}>{label}</a>)}</nav>
    {active === "overview" && <AdminOverview />}
    {active === "orders" && <AdminOrders notify={notify} />}
    {active === "products" && <ProductManager role={profile.role} notify={notify} />}
    {active === "users" && <AdminUsers me={profile} notify={notify} />}
    {active === "portfolio" && <ModelArea />}
    {active === "my-orders" && <MyOrders notify={notify} />}
  </section>;
}

/* ---------- Customer ---------- */
function OrderItems({ items }) {
  return <div className="order-items">{items.map((i) => <div key={i.product + i.size} className="order-item"><img src={i.image} alt="" /><div><a href={productHref(i)}>{i.name}</a><span>{i.size ? `Size ${i.size} · ` : ""}Qty {i.quantity} · {money(i.unitPrice)}</span></div></div>)}</div>;
}

function MyOrders({ notify }) {
  const { data, error, loading, reload } = useLoad(api.getMyOrders);
  const [busyId, setBusyId] = useState("");
  async function cancel(order) {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    setBusyId(order.id);
    try { await api.cancelMyOrder(order.id); notify("Order cancelled."); await reload(); }
    catch (e) { notify(e.message); }
    finally { setBusyId(""); }
  }
  if (loading) return <p className="page-muted">Loading orders…</p>;
  if (error) return <Err>{error}</Err>;
  if (!data.length) return <div className="empty-panel"><p>You haven’t placed any orders yet.</p><a className="solid-link" href="#shop">BROWSE THE EDIT</a></div>;
  return <div className="card-list">{data.map((o) => <article className="panel" key={o.id}>
    <header><div><strong>{o.orderNumber}</strong><span>{formatDate(o.createdAt)}</span></div><Status value={o.status} /></header>
    <OrderItems items={o.items} />
    <footer><span>Total <strong>{money(o.total)}</strong> · Cash on delivery · Payment {o.paymentStatus}</span>{["placed", "confirmed"].includes(o.status) && <button className="outline-button small" disabled={busyId === o.id} onClick={() => cancel(o)}>CANCEL ORDER</button>}</footer>
  </article>)}</div>;
}

/* ---------- Admin ---------- */
function AdminOverview() {
  const { data, error, loading } = useLoad(api.getAdminSummary);
  if (loading) return <p className="page-muted">Loading summary…</p>;
  if (error) return <Err>{error}</Err>;
  const u = data.users;
  const stats = [
    ["Revenue (excl. cancelled)", money(data.orders.revenue)],
    ["Orders", data.orders.count],
    ["Products live", `${data.products.published} / ${data.products.total}`],
    ["Customers", u.customer || 0],
    ["Designers", u.designer || 0],
    ["Models", u.model || 0]
  ];
  return <>
    <div className="stat-grid">{stats.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="two-col">
      <div className="panel"><h3>Orders by status</h3>{STATUSES.map((s) => <div className="kv" key={s}><Status value={s} /><strong>{data.orders.byStatus[s] || 0}</strong></div>)}</div>
      <div className="panel"><h3>Low or no stock</h3>{data.lowStock.length === 0 ? <p className="page-muted small">Everything is comfortably stocked.</p> : data.lowStock.map((p) => <div className="kv" key={p.id}><a href={productHref(p)}>{p.name}{p.isPublished ? "" : " (hidden)"}</a><strong>{p.inventory}</strong></div>)}</div>
    </div>
  </>;
}

function AdminOrders({ notify }) {
  const { data, error, loading, setData } = useLoad(api.getAllOrders);
  const [filter, setFilter] = useState("all");
  async function change(order, status) {
    try { const { order: updated } = await api.setOrderStatus(order.id, status); setData((list) => list.map((o) => (o.id === updated.id ? updated : o))); notify(`${order.orderNumber} → ${status}`); }
    catch (e) { notify(e.message); }
  }
  if (loading) return <p className="page-muted">Loading orders…</p>;
  if (error) return <Err>{error}</Err>;
  const rows = filter === "all" ? data : data.filter((o) => o.status === filter);
  return <>
    <div className="filter-row">{["all", ...STATUSES].map((s) => <button key={s} className={filter === s ? "chip active" : "chip"} onClick={() => setFilter(s)}>{s}</button>)}</div>
    {rows.length === 0 ? <div className="empty-panel"><p>No orders{filter === "all" ? " yet" : ` with status “${filter}”`}.</p></div> : <div className="card-list">{rows.map((o) => <article className="panel" key={o.id}>
      <header><div><strong>{o.orderNumber}</strong><span>{formatDate(o.createdAt)} · {o.customer?.fullName || o.customer?.email}</span></div>
        <select value={o.status} disabled={o.status === "cancelled"} onChange={(e) => change(o, e.target.value)} aria-label={`Status for ${o.orderNumber}`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></header>
      <OrderItems items={o.items} />
      <footer><span>{money(o.total)} · Payment {o.paymentStatus}</span><span className="muted-right">Ship to {o.shipping.fullName}, {o.shipping.line1}, {o.shipping.city}, {o.shipping.state} {o.shipping.postalCode} · {o.shipping.phone}</span></footer>
    </article>)}</div>}
  </>;
}

function AdminUsers({ me, notify }) {
  const { data, error, loading, setData } = useLoad(api.getAdminUsers);
  async function change(user, role) {
    try { const { user: updated } = await api.setUserRole(user.id, role); setData((list) => list.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u))); notify(`${user.email} is now ${role}.`); }
    catch (e) { notify(e.message); }
  }
  if (loading) return <p className="page-muted">Loading users…</p>;
  if (error) return <Err>{error}</Err>;
  return <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Role</th></tr></thead><tbody>
    {data.map((u) => <tr key={u.id}><td>{u.fullName || "—"}</td><td>{u.email}</td><td>{formatDate(u.createdAt)}</td><td>{u.role === "admin" || u.id === me.id ? <strong>{u.role}</strong> : <select value={u.role} onChange={(e) => change(u, e.target.value)} aria-label={`Role for ${u.email}`}><option value="customer">customer</option><option value="designer">designer</option><option value="model">model</option></select>}</td></tr>)}
  </tbody></table><p className="page-muted small">Administrators are provisioned on the server only (BOOTSTRAP_ADMIN_EMAIL) and cannot be changed here.</p></div>;
}

/* ---------- Admin + Designer: products ---------- */
const CATEGORIES = ["Dresses", "Tailoring", "Accessories", "Shoes", "Outerwear", "Jewellery", "Bags"];
const blank = { name: "", designer: "", category: "Dresses", price: "", inventory: "", tag: "", description: "", sizes: "", colors: "", material: "", care: "", details: "", images: "", isPublished: true, isFeatured: false };
const toForm = (p) => ({ name: p.name, designer: p.designer, category: p.category, price: p.price, inventory: p.inventory, tag: p.tag || "", description: p.description, sizes: (p.sizes || []).join(", "), colors: (p.colors || []).join(", "), material: p.material || "", care: p.care || "", details: (p.details || []).join("\n"), images: (p.images || []).map((i) => i.url).join("\n"), isPublished: p.isPublished, isFeatured: p.isFeatured });
const toPayload = (f) => ({ ...f, price: Number(f.price), inventory: Number(f.inventory || 0), sizes: f.sizes.split(","), colors: f.colors.split(","), details: f.details.split("\n"), images: f.images.split("\n").map((u) => u.trim()).filter(Boolean).map((url) => ({ url })) });

function ProductManager({ role, notify }) {
  const { data, error, loading, reload } = useLoad(api.getManagedProducts);
  const [editing, setEditing] = useState(null); // null | "new" | product
  async function toggle(p) {
    try { await api.updateProduct(p.id, { isPublished: !p.isPublished }); notify(p.isPublished ? "Product hidden from the shop." : "Product published."); reload(); }
    catch (e) { notify(e.message); }
  }
  if (editing) return <ProductForm role={role} product={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); notify("Product saved."); }} />;
  if (loading) return <p className="page-muted">Loading products…</p>;
  if (error) return <Err>{error}</Err>;
  return <>
    <div className="toolbar"><span className="page-muted small">{data.length} product{data.length === 1 ? "" : "s"}{role === "designer" ? " created by you" : ""}</span><button className="solid-button auto" onClick={() => setEditing("new")}>+ NEW PRODUCT</button></div>
    {data.length === 0 ? <div className="empty-panel"><p>No products yet. Create your first piece.</p></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>
      {data.map((p) => <tr key={p.id}><td><img className="thumb-sm" src={p.image} alt="" /></td><td><a href={productHref(p)}>{p.name}</a><br /><span className="page-muted small">{p.designer} · {p.category}</span></td><td>{money(p.price)}</td><td className={p.inventory <= 2 ? "low" : ""}>{p.inventory} <span className="page-muted small">{p.inventory <= 3 ? stockLabel(p.inventory) : ""}</span></td><td>{p.isPublished ? "Live" : "Hidden"}{p.isFeatured ? " · Featured" : ""}</td><td className="row-actions"><button className="link-button" onClick={() => setEditing(p)}>Edit</button><button className="link-button" onClick={() => toggle(p)}>{p.isPublished ? "Hide" : "Publish"}</button></td></tr>)}
    </tbody></table></div>}
  </>;
}

function ProductForm({ role, product, onCancel, onSaved }) {
  const [form, setForm] = useState(product ? toForm(product) : blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const payload = toPayload(form);
      if (!payload.images.length) throw new Error("Add at least one image URL.");
      if (role !== "admin") delete payload.isFeatured;
      if (product) await api.updateProduct(product.id, payload); else await api.createProduct(payload);
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className="form-grid product-form" onSubmit={submit}>
    <h3 className="span-2">{product ? `Edit: ${product.name}` : "New product"}</h3>
    <label className="span-2">Name<input value={form.name} onChange={set("name")} required maxLength={140} /></label>
    <label>Designer / label<input value={form.designer} onChange={set("designer")} placeholder={role === "designer" ? "Defaults to your name" : ""} maxLength={120} required={role === "admin"} /></label>
    <label>Category<select value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label>Price (₹)<input type="number" min="0" step="1" value={form.price} onChange={set("price")} required /></label>
    <label>Stock<input type="number" min="0" step="1" value={form.inventory} onChange={set("inventory")} required /></label>
    <label>Tag (e.g. NEW ARRIVAL)<input value={form.tag} onChange={set("tag")} maxLength={50} /></label>
    <label>Sizes (comma separated; empty = one size)<input value={form.sizes} onChange={set("sizes")} placeholder="XS, S, M, L" /></label>
    <label className="span-2">Description<textarea rows={3} value={form.description} onChange={set("description")} required maxLength={1200} /></label>
    <label>Colours (comma separated)<input value={form.colors} onChange={set("colors")} /></label>
    <label>Material<input value={form.material} onChange={set("material")} maxLength={200} /></label>
    <label className="span-2">Care<input value={form.care} onChange={set("care")} maxLength={300} /></label>
    <label className="span-2">Details (one per line)<textarea rows={3} value={form.details} onChange={set("details")} /></label>
    <label className="span-2">Image URLs (one per line, https://…; first is the cover)<textarea rows={3} value={form.images} onChange={set("images")} required /></label>
    <label className="check"><input type="checkbox" checked={form.isPublished} onChange={set("isPublished")} /> Published (visible in the shop)</label>
    {role === "admin" && <label className="check"><input type="checkbox" checked={form.isFeatured} onChange={set("isFeatured")} /> Featured (sorted first)</label>}
    {error && <p className="form-error span-2" role="alert">{error}</p>}
    <div className="span-2 form-actions"><button className="solid-button auto" disabled={busy}>{busy ? "SAVING…" : "SAVE PRODUCT"}</button><button type="button" className="outline-button" onClick={onCancel}>CANCEL</button></div>
  </form>;
}

/* ---------- Model ---------- */
function ModelArea() {
  return <div className="empty-panel"><h3>Your portfolio</h3><p>The model role is recognised by the server, but self-service portfolio editing hasn’t been built yet. Published model profiles are currently managed through the seed data.</p></div>;
}
