/* ===========================
   RETIRE — Site Cart (Header Drawer)
   - Single storage format (CART_KEY)
   - Works on every page (safe guards)
   - Drawer open/close
   - Shopify Storefront checkout
   =========================== */

   const SHOP_DOMAIN = 'itbiip-xv.myshopify.com';
   const CART_KEY = 'retire_cart_v1'; // <— single key everywhere
   
   // Storefront API for checkout creation
   const SF_DOMAIN = 'itbiip-xv.myshopify.com';
   const SF_TOKEN  = 'c4477df01824efd06e5c9f40f1f2229d';
   const SF_API    = `https://${SF_DOMAIN}/api/2025-07/graphql.json`;
   
   /* ---------- Local cart storage (single shape) ----------
     items: [
       { variantId: 'gid://shopify/ProductVariant/123', title, variantTitle, price, image, quantity }
     ]
   -------------------------------------------------------- */
   function readCart(){
     try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
     catch(_) { return []; }
   }
   function writeCart(items){
     localStorage.setItem(CART_KEY, JSON.stringify(items || []));
     renderCart();
     updateBadge();
     // sync other tabs
     try { localStorage.setItem(CART_KEY + '_ping', String(Date.now())); } catch(_){}
   }
   
   /* ---------- Elements (guarded) ---------- */
   const openBtn  = document.getElementById('openCart');
   const overlay  = document.querySelector('.cart-overlay');
   const panel    = document.querySelector('.cart-panel');
   const listBox  = document.getElementById('cartItems');
   const subtotal = document.getElementById('cartSubtotal');
   const checkout = document.getElementById('cartCheckout');
   const closeBtn = document.getElementById('cartClose');
   const badge    = document.getElementById('cartCount');
   
   /* ---------- Helpers ---------- */
   function money(n){
     const v = Number(n || 0);
     return isFinite(v) ? `$${v.toFixed(2)} USD` : `$${n} USD`;
   }
   function sum(items){
     return items.reduce((t, it) => t + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
   }
   function updateBadge(){
     const items = readCart();
     const qty = items.reduce((n,i)=>n + (i.quantity||0), 0);
     if (!badge) return;
     if (qty > 0){ badge.style.display = 'grid'; badge.textContent = String(qty); }
     else { badge.style.display = 'none'; }
   }
   
   /* ---------- Drawer open/close ---------- */
   function openCart(){
     if (overlay) overlay.classList.add('show');
     if (panel)   panel.classList.add('open');
   }
   function closeCart(){
     if (overlay) overlay.classList.remove('show');
     if (panel)   panel.classList.remove('open');
   }
   
   // Bind (prevent default navigation)
   openBtn && openBtn.addEventListener('click', (e)=>{ e.preventDefault(); openCart(); });
   overlay && overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeCart(); });
   closeBtn && closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeCart(); });
   window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeCart(); });
   
   /* ---------- Render ---------- */
   function renderCart(){
     const items = readCart();
   
     if (listBox){
       if (!items.length){
         listBox.innerHTML = `<div class="muted" style="padding:16px">Your cart is empty.</div>`;
       } else {
         listBox.innerHTML = items.map((it, idx) => {
           const img = it.image || '/assets/img/placeholder.jpg';
           const alt = it.title || 'Product';
           const opts = it.variantTitle && it.variantTitle !== 'Default Title' ? ` • ${it.variantTitle}` : '';
           const price = Number(it.price || 0) * Number(it.quantity || 1);
           return `
             <div class="cart-item" data-index="${idx}">
               <div class="cart-thumb"><img src="${img}" alt="${alt}"></div>
               <div class="cart-meta">
                 <div class="title">${alt}</div>
                 <div class="muted">${opts ? it.variantTitle : ''}</div>
                 <div class="cart-qty">
                   <button type="button" class="js-decr" aria-label="Decrease">−</button>
                   <span>${it.quantity || 1}</span>
                   <button type="button" class="js-incr" aria-label="Increase">+</button>
                 </div>
               </div>
               <div class="cart-price">${money(price)}</div>
             </div>`;
         }).join('');
       }
     }
   
     if (subtotal){ subtotal.textContent = money(sum(items)); }
   }
   
   /* Quantity controls */
   listBox && listBox.addEventListener('click', (e)=>{
     const row = e.target.closest('.cart-item');
     if (!row) return;
     const idx = Number(row.dataset.index);
     const items = readCart();
     const it = items[idx];
     if (!it) return;
   
     if (e.target.classList.contains('js-incr')){
       it.quantity = Math.max(1, Number(it.quantity || 1) + 1);
       writeCart(items);
     }
     if (e.target.classList.contains('js-decr')){
       const q = Math.max(0, Number(it.quantity || 1) - 1);
       if (q === 0){ items.splice(idx, 1); }
       else { it.quantity = q; }
       writeCart(items);
     }
   });
   
   /* ---------- Checkout via Storefront API ---------- */
   async function createCheckoutUrlFromLocalCart(){
     const items = readCart().filter(i => i && i.variantId && i.quantity > 0);
     if (!items.length) return null;
   
     // Storefront lines
     const lines = items.map(it => ({
       merchandiseId: String(it.variantId).startsWith('gid://')
         ? it.variantId
         : `gid://shopify/ProductVariant/${String(it.variantId).split('/').pop()}`,
       quantity: Math.max(1, Number(it.quantity || 1))
     }));
   
     const query = `
       mutation CreateCart($input: CartInput!) {
         cartCreate(input: $input) {
           cart { checkoutUrl }
           userErrors { message }
         }
       }
     `;
   
     const res = await fetch(SF_API, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-Shopify-Storefront-Access-Token': SF_TOKEN
       },
       body: JSON.stringify({ query, variables: { input: { lines } } })
     });
   
     if (!res.ok) throw new Error('Storefront API HTTP ' + res.status);
     const json = await res.json();
     const url = json?.data?.cartCreate?.cart?.checkoutUrl;
     const errs = json?.data?.cartCreate?.userErrors;
     if (url) return url;
   
     if (errs && errs.length){ console.warn('Storefront cartCreate errors:', errs); }
     return null;
   }
   
   checkout && checkout.addEventListener('click', async (e) => {
     e.preventDefault();
   
     try {
       const url = await createCheckoutUrlFromLocalCart();
       if (url) { window.location.href = url; return; }
     } catch (err) {
       console.error('checkout error', err);
     }
   
     // Fallback
     const items = readCart().filter(i => i && i.variantId && i.quantity > 0);
     if (!items.length) return;
   
     const params = new URLSearchParams();
     items.forEach((it, i) => {
       const id = String(it.variantId).split('/').pop();
       params.set(`items[${i}][id]`, id);
       params.set(`items[${i}][quantity]`, String(it.quantity || 1));
     });
     params.set('return_to', '/checkout');
     window.location.href = `https://${SHOP_DOMAIN}/cart/add?${params.toString()}`;
   });
   
   /* ---------- Public API for PDP etc. ---------- */
   window.RETIRE_CART = {
     add(item){
       if (!item || !item.variantId) return;
       const items = readCart();
   
       const id = String(item.variantId);
       const existing = items.find(i => String(i.variantId) === id);
   
       if (existing){
         existing.quantity = Math.max(1, Number(existing.quantity || 1) + Number(item.quantity || 1));
         if (item.price != null)  existing.price = Number(item.price);
         if (item.image)          existing.image = item.image;
         if (item.title)          existing.title = item.title;
         if (item.variantTitle)   existing.variantTitle = item.variantTitle;
       } else {
         items.push({
           variantId: id,
           title: item.title || '',
           variantTitle: item.variantTitle || '',
           price: Number(item.price || 0), // unit price
           image: item.image || '',
           quantity: Math.max(1, Number(item.quantity || 1)),
         });
       }
       writeCart(items);
     },
     open: openCart,
     close: closeCart,
     items: readCart
   };
   
   /* ---------- Init + cross-tab sync ---------- */
   renderCart();
   updateBadge();
   
   window.addEventListener('storage', (e)=>{
     if (e.key === CART_KEY || e.key === CART_KEY + '_ping'){
       renderCart();
       updateBadge();
     }
   });
   