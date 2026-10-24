export const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const productKey = (p) => p.slug || p.id;
export const productHref = (p) => `#/product/${encodeURIComponent(productKey(p))}`;
export const stockLabel = (n) => (n === undefined || n === null ? "" : n <= 0 ? "Sold out" : n <= 3 ? `Only ${n} left` : "In stock");
