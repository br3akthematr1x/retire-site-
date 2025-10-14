/* ===== RETIRE PDP (headless) =====
   Adds: recommendations band styled like your cards
   PDP now adds to the on-site header cart only (no Shopify redirect).
*/
(function(){
  'use strict';

  const SF_DOMAIN = 'itbiip-xv.myshopify.com';
  const SF_TOKEN  = 'c4477df01824efd06e5c9f40f1f2229d';
  const SF_API    = `https://${SF_DOMAIN}/api/2024-10/graphql.json`;

  function qs(name){ return new URLSearchParams(location.search).get(name); }
  function money(amount, code){
    const n = Number(amount);
    return Number.isNaN(n) ? `${amount} ${code||''}` : `$${n.toFixed(2)} USD`;
  }

  async function fetchProductByHandle(handle){
    const query = `
      query($handle: String!){
        product(handle: $handle){
          id
          title handle descriptionHtml vendor
          featuredImage { url altText }
          images(first: 12){ edges{ node{ url altText } } }
          options{ name values }
          variants(first: 100){
            nodes{
              id title availableForSale
              selectedOptions{ name value }
              price { amount currencyCode }
            }
          }
          onlineStoreUrl
          totalInventory
        }
      }`;
    const res = await fetch(SF_API, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Shopify-Storefront-Access-Token': SF_TOKEN
      },
      body: JSON.stringify({ query, variables:{ handle } })
    });
    if(!res.ok){
      console.error('PDP fetchProductByHandle HTTP', res.status, await res.text());
      throw new Error('API '+res.status);
    }
    const json = await res.json();
    if (json.errors) console.error('PDP GraphQL errors:', json.errors);
    return json.data?.product || null;
  }

  async function fetchRecommendations(productId){
    const query = `
      query($id: ID!){
        productRecommendations(productId: $id){
          title handle
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
        }
      }`;
    const res = await fetch(SF_API, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Shopify-Storefront-Access-Token': SF_TOKEN
      },
      body: JSON.stringify({ query, variables:{ id: productId } })
    });
    if(!res.ok){
      console.warn('PDP fetchRecommendations HTTP', res.status, await res.text());
      throw new Error('API '+res.status);
    }
    const json = await res.json();
    if (json.errors) console.warn('PDP Recos GraphQL errors:', json.errors);
    return json.data?.productRecommendations || [];
  }

  function renderGallery(prod){
    const hero = document.getElementById('pdpHero');
    const thumbs = document.getElementById('pdpThumbs');
    const imgs = (prod.images?.edges?.map(e=>e.node) || []);
    const first = imgs[0] || prod.featuredImage;

    hero.src = first?.url || '/assets/img/placeholder.jpg';
    hero.alt = first?.altText || prod.title;

    thumbs.innerHTML = imgs.map((im, i) => `
      <button class="pdp-thumb ${i===0?'is-active':''}" data-src="${im.url}" aria-label="View image ${i+1}">
        <img src="${im.url}" alt="${(im.altText||prod.title).replace(/"/g,'&quot;')}">
      </button>`).join('');

    thumbs.querySelectorAll('.pdp-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        hero.src = btn.dataset.src;
        thumbs.querySelectorAll('.pdp-thumb').forEach(b=>b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  // helper to escape vendor for regex
  function escapeRegExp(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function renderInfo(prod){
    document.getElementById('pdpTitle').textContent = prod.title;
    document.getElementById('crumbTitle').textContent = prod.title;

    // Hide vendor badge entirely
    const vendEl = document.getElementById('pdpVendor');
    if (vendEl) vendEl.hidden = true;

    const firstVar = prod.variants.nodes[0];
    document.getElementById('pdpPrice').textContent = money(firstVar?.price?.amount, firstVar?.price?.currencyCode);

    // Strip a standalone vendor line from description if present
    let desc = prod.descriptionHtml || '';
    const ven = (prod.vendor || '').trim();
    if (ven) {
      const pattern = new RegExp(
        `^(?:\\s*<p>\\s*)?${escapeRegExp(ven)}\\s*(?:</p>)?(?:\\s*(?:<br\\s*/?>)?)\\s*`,
        'i'
      );
      desc = desc.replace(pattern, '');
    }
    document.getElementById('pdpDesc').innerHTML = desc;

    const inStock = prod.variants.nodes.some(v => v.availableForSale);
    const badge = document.getElementById('stockBadge');
    if (inStock) { badge.hidden = false; badge.querySelector('span').textContent = 'In Stock'; }
    else { badge.hidden = false; badge.querySelector('span').textContent = 'Out of Stock'; }

    const view = document.getElementById('viewOnShopify');
    view.href = prod.onlineStoreUrl || `https://${SF_DOMAIN}/products/${prod.handle}`;
  }

  function buildOptions(prod){
    const box = document.getElementById('optionRows');
    box.innerHTML = '';
    const options = prod.options || [];
    options.forEach((opt, idx) => {
      const id = `opt_${idx}`;
      const html = `
        <div class="pdp-row">
          <label for="${id}">${opt.name}</label>
          <select id="${id}" class="pdp-select" data-opt="${opt.name}">
            ${opt.values.map(v=>`<option value="${v}">${v}</option>`).join('')}
          </select>
        </div>`;
      box.insertAdjacentHTML('beforeend', html);
    });
    return options.map((_,i)=>document.getElementById(`opt_${i}`));
  }

  function findVariant(prod, selections){
    return prod.variants.nodes.find(v =>
      v.selectedOptions.every(so => selections[so.name] === so.value)
    );
  }

  /* Accordions */
  function wireAccordions(){
    document.querySelectorAll('.acc-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        const panel = btn.nextElementSibling;
        panel.classList.toggle('show', !expanded);
      });
    });
  }

  // Add to your on-site header cart (no Shopify redirect)
  async function addToHeaderCart({variantId, quantity, title, price, image, variantTitle}){
    if (window.RETIRE_CART?.add) {
      window.RETIRE_CART.add({
        variantId: String(variantId),
        quantity: Number(quantity),
        title,
        price: Number(price),
        image,
        variantTitle: variantTitle || ''
      });
    } else {
      // Optional fallback event if cart.js loads late
      document.dispatchEvent(new CustomEvent('retire:cart:add', {
        detail: { variantId: String(variantId), quantity: Number(quantity), title, price: Number(price), image, variantTitle: variantTitle || '' }
      }));
    }
    // Respect your “no auto-open” behavior — do not open the drawer here.
  }

  function wireForm(prod){
    const selects = buildOptions(prod);
    const qty = document.getElementById('qty');
    const priceEl = document.getElementById('pdpPrice');
    const bar = document.getElementById('pdpBar');
    const barPrice = document.getElementById('barPrice');
    const barVariant = document.getElementById('barVariant');
    const barAdd = document.getElementById('barAdd');
    const heroImg = document.getElementById('pdpHero');

    function currentSelections(){
      const map = {};
      selects.forEach(s => { map[s.dataset.opt] = s.value; });
      return map;
    }

    function currentVariant(){
      return findVariant(prod, currentSelections()) || prod.variants.nodes[0];
    }

    function updatePrice(){
      const v = currentVariant();
      const pTxt = money(v.price.amount, v.price.currencyCode);
      priceEl.textContent = pTxt;
      barPrice.textContent = pTxt;
      barVariant.textContent = v.title;
      document.getElementById('addBtn').disabled = !v.availableForSale;
      barAdd.disabled = !v.availableForSale;
    }

    selects.forEach(s => s.addEventListener('change', updatePrice));
    updatePrice();

    // Mobile sticky bar
    bar.setAttribute('aria-hidden', 'false');
    barAdd.addEventListener('click', (e)=>{
      e.preventDefault();
      document.getElementById('pdpForm').dispatchEvent(new Event('submit', {cancelable:true}));
    });

    const form = document.getElementById('pdpForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = currentVariant();
      const q = Math.max(1, parseInt(qty.value||'1',10));
      const variantId = v.id.split('/').pop(); // numeric variant id
      try {
        await addToHeaderCart({
          variantId,
          quantity: q,
          title: prod.title,
          variantTitle: v.title,
          price: Number(v.price.amount),
          image: heroImg?.src || prod.featuredImage?.url || ''
        });
      } catch (err) {
        console.error('Header cart add failed:', err);
        alert('Could not add to cart. Please try again.');
      }
    });
  }

  /* ===== Recommendations ===== */
  function renderRecommendations(items){
    const wrap = document.getElementById('recoSection');
    const grid = document.getElementById('recoGrid');
    if (!grid) return;

    if (!items || !items.length){
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    grid.innerHTML = items.map(p=>{
      const url = `/product.html?handle=${encodeURIComponent(p.handle)}`;
      const img = p.featuredImage?.url || '/assets/img/placeholder.jpg';
      const alt = p.featuredImage?.altText || p.title;
      const pr  = p.priceRange?.minVariantPrice;
      const price = pr ? money(pr.amount, pr.currencyCode) : '';
      return `
        <a class="card" href="${url}">
          <div class="media"><img src="${img}" alt="${alt}"></div>
          <div class="content">
            <h3 class="title">${p.title}</h3>
            <div class="row"><span class="price">${price}</span></div>
          </div>
        </a>`;
    }).join('');
  }

  (async function init(){
    const handle = qs('handle');
    if(!handle){
      console.error('PDP: missing ?handle= in URL');
      document.getElementById('pdpError').hidden = false; 
      return; 
    }
    try{
      const product = await fetchProductByHandle(handle);
      if(!product){
        console.error('PDP: product not found for handle', handle);
        document.getElementById('pdpError').hidden = false; 
        return; 
      }

      renderGallery(product);
      renderInfo(product);
      wireForm(product);
      wireAccordions();

      try {
        const recos = await fetchRecommendations(product.id);
        renderRecommendations(recos);
      } catch (e) {
        console.warn('PDP: recommendations failed', e);
        document.getElementById('recoSection').hidden = true;
      }
    }catch(e){
      console.error('PDP init error:', e);
      document.getElementById('pdpError').hidden = false;
    }
  })();

})();
