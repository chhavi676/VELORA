import { useCallback, useEffect, useState } from "react";

const KEY = "velora.cart.v1";
const MAX_QTY = 10;

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.productId && i.quantity > 0) : [];
  } catch { return []; }
}

// A cart line is identified by product + size. Prices here are only for display;
// the server always re-prices the order from the database.
export const lineKey = (item) => `${item.productId}|${item.size || ""}`;

export function useCart() {
  const [items, setItems] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ } }, [items]);

  const add = useCallback((product, size = "", quantity = 1) => {
    const line = { productId: product.id, slug: product.slug || product.id, name: product.name, designer: product.designer, image: product.image || product.images?.[0]?.url || "", price: product.price, size, quantity, max: Math.min(MAX_QTY, product.inventory ?? MAX_QTY) };
    setItems((current) => {
      const found = current.find((i) => lineKey(i) === lineKey(line));
      if (found) return current.map((i) => (lineKey(i) === lineKey(line) ? { ...i, price: line.price, max: line.max, quantity: Math.min(line.max || MAX_QTY, i.quantity + quantity) } : i));
      return [...current, { ...line, quantity: Math.min(line.max || MAX_QTY, quantity) }];
    });
  }, []);
  const setQuantity = useCallback((key, quantity) => setItems((c) => c.map((i) => (lineKey(i) === key ? { ...i, quantity: Math.max(1, Math.min(i.max || MAX_QTY, quantity)) } : i))), []);
  const remove = useCallback((key) => setItems((c) => c.filter((i) => lineKey(i) !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, add, setQuantity, remove, clear, count, total };
}
