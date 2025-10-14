/* ===========================
   RETIRE Favorites (local)
   =========================== */

   const SHOP_DOMAIN = 'itbiip-xv.myshopify.com';
   const STOREFRONT_TOKEN = 'c4477df01824efd06e5c9f40f1f2229d';
   const API_URL = `https://${SHOP_DOMAIN}/api/2025-07/graphql.json`;
   const STORAGE_KEY = 'retire:favorites'; // stores array of product handles
   
   /* -------- storage helpers -------- */
   function getFavs(){
     try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(_) { return []; }
   }
   function setFavs(list){
     localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(list))));
   }
   function addFav(handle){
     const list = getFavs();
     if (!list.includes(handle)) { list.push(handle); setFavs(list); }
   }
   function removeFav(handle){
     const list = getFavs().filter(h => h !== handle);
     setFavs(list);
   }
   
   /* -------- fetch product data for handles -------- */
   async function fetchProducts(handles){
     if (!handles.length) return [];
     const query = `
       query($handles:[String!]!) {
         nodes(ids: []) { id } # placeholder to satisfy parser (ignored)
         ${handles.map((h,i)=>`
           h${i}: productByHandle(handle:"${h}") {
             id handle title
             featuredImage { url altText }
             priceRange { minVariantPrice { amount currencyCode } }
             variants(first: 10) { nodes { id title availableForSale } }
           }
         `).join('\n')}
       }
     `;
     const res = await fetch(API_URL, {
       method:'POST',
       headers:{
         'Content-Type':'application/json',
         'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
       },
       body: JSON.stringify({ query })
     });
     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     const json = await res.json();
     const products = [];
     handles.forEach((h,i)=>{
       const p = json.data[`h${i}`];
       if (p) products.push(p);
     });
     return products;
   }
   
   function money(amount, code){ return `$${Number(amount).toFixed(2)} ${code || 'USD'}`; }
   function gidToId(gid){ return gid?.split('/').pop(); }
   
   /* -------- render grid -------- */
   async function renderFavs(){
     const grid = document.getElementById('favGrid');
     const empty = document.getElementById('favEmpty');
     if (!grid || !empty) return;
   
     // Allow ?add=<handle> sugar
     const params = new URLSearchParams(location.search);
     const addHandle = params.get('add');
     if (addHandle) addFav(addHandle);
   
     const favs = getFavs();
     if (!favs.length){
       empty.style.display = 'block';
       grid.innerHTML = '';
       return;
     }
   
     try{
       const products = await fetchProducts(favs);
   
       grid.innerHTML = products.map(p=>{
         const img = p.featuredImage?.url || '/assets/img/placeholder.jpg';
         const imgAlt = (p.featuredImage?.altText || p.title).replace(/"/g,'&quot;');
         const price = money(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode);
         const firstAvail = p.variants.nodes.find(v=>v.availableForSale) || p.variants.nodes[0];
         const variantId = gidToId(firstAvail?.id);
         const productUrl = `https://${SHOP_DOMAIN}/products/${p.handle}`;
         const addUrl = variantId
           ? `https://${SHOP_DOMAIN}/cart/add?items[0][id]=${variantId}&items[0][quantity]=1&return_to=/cart`
           : productUrl;
   
         return `
         <article class="card" data-handle="${p.handle}">
           <a class="media" href="${productUrl}" target="_blank" rel="noreferrer">
             <img src="${img}" alt="${imgAlt}">
           </a>
           <div class="content">
             <h3 class="title">${p.title}</h3>
             <div class="row"><span class="price">${price}</span></div>
             <div class="actions">
               <button class="btn" data-remove="${p.handle}">Remove</button>
               <a class="btn" href="${productUrl}" target="_blank" rel="noreferrer">View</a>
               <a class="btn primary" href="${addUrl}">Add to Cart</a>
             </div>
           </div>
         </article>`;
       }).join('');
   
       // Wire remove buttons
       grid.querySelectorAll('[data-remove]').forEach(btn=>{
         btn.addEventListener('click', ()=>{
           const handle = btn.getAttribute('data-remove');
           removeFav(handle);
           renderFavs();
         });
       });
   
     } catch(err){
       grid.innerHTML = `<p class="muted">Could not load favorites right now. ${String(err)}</p>`;
     }
   }
   
   document.addEventListener('DOMContentLoaded', renderFavs);
   