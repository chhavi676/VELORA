import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../lib/auth.jsx";
import { lineKey } from "../lib/cart.js";
import { createOrder } from "../services/api.js";
import { money } from "../lib/format.js";

const EMPTY = { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" };

export default function CheckoutPage({ cart }) {
  const { session, profile, loading } = useAuth();
  const [form, setForm] = useState({ ...EMPTY, fullName: profile?.fullName || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  if (placed) {
    return <section className="page-shell narrow">
      <p className="eyebrow">ORDER PLACED</p>
      <h1 className="page-title">Thank you.</h1>
      <p className="page-muted">Your order <strong>{placed.orderNumber}</strong> has been placed. You will pay <strong>{money(placed.total)}</strong> on delivery.</p>
      <div className="confirm-lines">{placed.items.map((i) => <div key={i.product + i.size}><span>{i.name}{i.size ? ` · ${i.size}` : ""} × {i.quantity}</span><span>{money(i.unitPrice * i.quantity)}</span></div>)}</div>
      <p className="page-muted">Delivering to {placed.shipping.fullName}, {placed.shipping.line1}, {placed.shipping.city} {placed.shipping.postalCode}.</p>
      <div className="page-actions"><a className="solid-link" href="#/dashboard/orders">VIEW MY ORDERS</a><a className="outline-link" href="#shop">CONTINUE SHOPPING</a></div>
    </section>;
  }

  if (loading) return <section className="page-shell narrow"><p className="page-muted">Checking your session…</p></section>;

  if (!session || !profile) {
    return <section className="page-shell narrow"><a className="back-link" href="#shop"><ArrowLeft size={14}/> BACK TO THE EDIT</a><p className="eyebrow">CHECKOUT</p><h1 className="page-title">Sign in to place your order.</h1><p className="page-muted">Your bag is saved on this device, so nothing will be lost.</p><div className="page-actions"><a className="solid-link" href="#account">SIGN IN OR CREATE AN ACCOUNT</a></div></section>;
  }

  if (cart.items.length === 0) {
    return <section className="page-shell narrow"><p className="eyebrow">CHECKOUT</p><h1 className="page-title">Your bag is empty.</h1><div className="page-actions"><a className="solid-link" href="#shop">BROWSE THE EDIT</a></div></section>;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const { order } = await createOrder({
        items: cart.items.map((i) => ({ productId: i.productId, size: i.size, quantity: i.quantity })),
        shipping: form,
        paymentMethod: "cod"
      });
      cart.clear();
      setPlaced(order);
      window.scrollTo({ top: 0 });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <section className="page-shell checkout">
    <a className="back-link" href="#shop"><ArrowLeft size={14}/> CONTINUE SHOPPING</a>
    <p className="eyebrow">CHECKOUT</p>
    <h1 className="page-title">Delivery details</h1>
    <div className="checkout-grid">
      <form className="form-grid" onSubmit={submit}>
        <label className="span-2">Full name<input value={form.fullName} onChange={set("fullName")} required maxLength={120} autoComplete="name"/></label>
        <label>Phone<input value={form.phone} onChange={set("phone")} required inputMode="tel" maxLength={20} autoComplete="tel"/></label>
        <label>PIN code<input value={form.postalCode} onChange={set("postalCode")} required inputMode="numeric" pattern="[0-9]{6}" title="6-digit PIN code" maxLength={6} autoComplete="postal-code"/></label>
        <label className="span-2">Address line 1<input value={form.line1} onChange={set("line1")} required maxLength={200} autoComplete="address-line1"/></label>
        <label className="span-2">Address line 2 (optional)<input value={form.line2} onChange={set("line2")} maxLength={200} autoComplete="address-line2"/></label>
        <label>City<input value={form.city} onChange={set("city")} required maxLength={80} autoComplete="address-level2"/></label>
        <label>State<input value={form.state} onChange={set("state")} required maxLength={80} autoComplete="address-level1"/></label>
        <fieldset className="span-2 pay-box"><legend>PAYMENT</legend><label className="radio-row"><input type="radio" checked readOnly/> Cash on delivery</label><p>Online payment (UPI / cards) isn’t enabled in this demo.</p></fieldset>
        {error && <p className="form-error span-2" role="alert">{error}</p>}
        <button className="solid-button span-2" type="submit" disabled={busy}>{busy ? "PLACING ORDER…" : `PLACE ORDER · ${money(cart.total)}`}</button>
      </form>
      <aside className="summary">
        <h2>Your selection</h2>
        {cart.items.map((i) => <div className="summary-line" key={lineKey(i)}><img src={i.image} alt=""/><div><strong>{i.name}</strong><span>{i.size ? `Size ${i.size} · ` : ""}Qty {i.quantity}</span></div><span>{money(i.price * i.quantity)}</span></div>)}
        <div className="summary-total"><span>Shipping</span><span>Complimentary</span></div>
        <div className="summary-total grand"><span>Total</span><span>{money(cart.total)}</span></div>
        <p className="page-muted small">Final prices and stock are confirmed by the server when you place the order.</p>
      </aside>
    </div>
  </section>;
}
