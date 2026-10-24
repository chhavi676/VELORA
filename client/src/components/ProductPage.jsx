import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { getProduct } from "../services/api.js";
import { money, productHref, stockLabel } from "../lib/format.js";

export default function ProductPage({ slug, catalogue, onAdd }) {
  const fallback = useMemo(() => catalogue.find((p) => p.slug === slug || p.id === slug) || null, [catalogue, slug]);
  const [product, setProduct] = useState(fallback);
  const [status, setStatus] = useState(fallback ? "ready" : "loading");
  const [activeImage, setActiveImage] = useState(0);
  const [size, setSize] = useState("");
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let active = true;
    setActiveImage(0); setSize(""); setSizeError(false); setAdded(false);
    getProduct(slug)
      .then((data) => { if (active) { setProduct(data); setStatus("ready"); } })
      .catch((e) => { if (active) { if (!fallback) setStatus(e.status === 404 ? "missing" : "error"); } });
    return () => { active = false; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") return <section className="page-shell"><p className="page-muted">Loading piece…</p></section>;
  if (!product || status === "missing" || status === "error") {
    return <section className="page-shell"><a className="back-link" href="#shop"><ArrowLeft size={14}/> BACK TO THE EDIT</a><h1 className="page-title">{status === "error" ? "We couldn’t load this piece." : "This piece isn’t available."}</h1><p className="page-muted">{status === "error" ? "Check that the VÉLORA server is running, then refresh." : "It may have been withdrawn or is no longer published."}</p></section>;
  }

  const images = product.images?.length ? product.images : [{ url: product.image, alt: product.name }];
  const soldOut = product.inventory !== undefined && product.inventory <= 0;
  const needsSize = (product.sizes || []).length > 0;
  const related = catalogue.filter((p) => p.category === product.category && (p.slug || p.id) !== (product.slug || product.id)).slice(0, 4);

  function handleAdd() {
    if (needsSize && !size) { setSizeError(true); return; }
    onAdd(product, size);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return <section className="page-shell product-page">
    <a className="back-link" href="#shop"><ArrowLeft size={14}/> BACK TO THE EDIT</a>
    <div className="product-detail">
      <div className="gallery">
        <div className="gallery-main"><img src={images[activeImage]?.url} alt={images[activeImage]?.alt || product.name}/></div>
        {images.length > 1 && <div className="gallery-thumbs">{images.map((img, i) => <button key={img.url + i} className={i === activeImage ? "thumb active" : "thumb"} onClick={() => setActiveImage(i)} aria-label={`Show image ${i + 1}`}><img src={img.url} alt=""/></button>)}</div>}
      </div>
      <div className="detail-info">
        <p className="eyebrow">{product.category.toUpperCase()}{product.tag ? ` · ${product.tag}` : ""}</p>
        <h1 className="page-title">{product.name}</h1>
        <p className="detail-designer">by {product.designer}{product.designerVerified ? " · Verified designer" : ""}</p>
        <p className="detail-price">{money(product.price)}</p>
        <p className="detail-desc">{product.description}</p>

        {needsSize && <div className="option-block">
          <div className="option-head"><span>SIZE</span>{sizeError && <em role="alert">Please choose a size</em>}</div>
          <div className="size-list">{product.sizes.map((s) => <button key={s} type="button" className={size === s ? "size-chip active" : "size-chip"} onClick={() => { setSize(s); setSizeError(false); }}>{s}</button>)}</div>
        </div>}
        {(product.colors || []).length > 0 && <div className="option-block"><div className="option-head"><span>COLOUR</span></div><p className="detail-colors">{product.colors.join(" · ")}</p></div>}

        <button className="detail-add" type="button" disabled={soldOut} onClick={handleAdd}>{soldOut ? "SOLD OUT" : added ? <>ADDED TO BAG <Check size={15}/></> : "ADD TO BAG"}</button>
        {product.inventory !== undefined && !soldOut && <p className={product.inventory <= 3 ? "stock-note low" : "stock-note"}>{stockLabel(product.inventory)}</p>}

        <dl className="spec-list">
          {product.material && <><dt>Material</dt><dd>{product.material}</dd></>}
          {product.care && <><dt>Care</dt><dd>{product.care}</dd></>}
          <dt>Delivery</dt><dd>Complimentary shipping. Cash on delivery available.</dd>
        </dl>
        {(product.details || []).length > 0 && <ul className="detail-bullets">{product.details.map((d) => <li key={d}>{d}</li>)}</ul>}
      </div>
    </div>
    {related.length > 0 && <div className="related"><h2 className="related-title">More in {product.category}</h2><div className="related-grid">{related.map((p) => <a key={p.id || p.slug} href={productHref(p)} className="related-card"><img src={p.image || p.images?.[0]?.url} alt={p.name} loading="lazy"/><span>{p.name}</span><strong>{money(p.price)}</strong></a>)}</div></div>}
  </section>;
}
