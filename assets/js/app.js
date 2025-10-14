/* ===========================
   RETIRE Static Storefront
   Minimal JS (no framework)
   =========================== */

/* === Configure these 3 values === */
const SHOP_DOMAIN = "shop.retireyourbloodline.com";          // e.g., shop.retireyourbloodline.com or yourstore.myshopify.com
const COLLECTION_HANDLE = "best-sellers";                     // collection to show on the grid
const STOREFRONT_TOKEN = "PASTE_PUBLIC_STOREFRONT_API_TOKEN_HERE"; // Shopify → Apps & sales channels → Headless → Storefront API token

/* === Header links === */
const cartLink = document.getElementById('cartLink');
if (cartLink) cartLink.href = `https://${SHOP_DOMAIN}/cart`;

const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
if (searchForm) {
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = encodeURIComponent(searchInput?.value || "");
    window.location.href = `https://${SHOP_DOMAIN}/search?q=${q}`;
  });
}

/* === Drawer menu wiring === */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawerOverlay');
const menuBtn = document.getElementById('menuBtn');
const closeBtn = document.getElementById('closeDrawer');

function openDrawer() {
  drawer?.classList.add('open');
  drawer?.removeAttribute('hidden');
  overlay?.classList.add('show');
  overlay?.removeAttribute('hidden');
  menuBtn?.setAttribute('aria-expanded', 'true');
}

function closeDrawer() {
  drawer?.classList.remove('open');
  drawer?.setAttribute('hidden', '');
  overlay?.classList.remove('show');
  overlay?.setAttribute('hidden', '');
  menuBtn?.setAttribute('aria-expanded', 'false');
}

menuBtn?.addEventListener('click', openDrawer);
closeBtn?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/* === Drawer links (Products/About/Contact) === */
const menuProducts = document.getElementById('menuProducts');
const menuAbout = document.getElementById('menuAbout');
const menuContact = document.getElementById('menuContact');

if (menuProducts) menuProducts.href = `https://${SHOP_DOMAIN}/collections/all`;
if (menuAbout) menuAbout.href = `https://${SHOP_DOMAIN}/pages/about`;
if (menuContact) menuContact.href = `https://${SHOP_DOMAIN}/pages/contact`;

/* === Helpers === */
const API = `https://${SHOP_DOMAIN}/api/2025-07/graphql.json`;
function money(amount) {
  const n = Number(amount);
  return Number.isNaN(n) ? amount : `$${n.toFixed(2)} USD`;
}
function gidToId(gid) { return gid?.split('/').pop(); } // gid://shopify/ProductVariant/123 -> 123

/* === Fetch & render products from a collection === */
async function loadCollection(handle) {
  const query = `
    query($handle: String!) {
      collection(handle: $handle) {
        products(first: 8) {
          nodes {
            id handle title
            featuredImage { url altText }
            priceRange { minVariantPrice { amount currencyCode } }
            variants(first: 10) { nodes { id title availableForSale } }
          }
        }
      }
    }`;

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables: { handle } })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const grid = document.getElementById('grid');
    if (!json.data?.collection) {
      if (grid) grid.innerHTML = `<p class="muted">Collection not found. Check COLLECTION_HANDLE.</p>`;
      return;
    }

    const products = json.data.collection.products.nodes;
    renderProducts(products);
  } catch (err) {
    const grid = document.getElementById('grid');
    if (grid) grid.innerHTML = `<p class="muted">Could not load products. Check your token/domain. (${String(err)})</p>`;
  }
}

function renderProducts(products) {
  const grid = document.getElementById('grid');
  if (!grid) return;

  grid.innerHTML = products.map(p => {
    const firstVariant = p.variants.nodes.find(v => v.availableForSale) || p.variants.nodes[0];
    const variantId = gidToId(firstVariant?.id);
    const price = money(p.priceRange.minVariantPrice.amount);
    const productUrl = `https://${SHOP_DOMAIN}/products/${p.handle}`;
    // To send to cart instead of checkout, change return_to=/checkout → /cart, or remove return_to entirely.
    const addUrl = variantId
      ? `https://${SHOP_DOMAIN}/cart/add?items[0][id]=${variantId}&items[0][quantity]=1&return_to=/checkout`
      : productUrl; // if no variant id, send to product page

    const imgUrl = p.featuredImage?.url || '/assets/img/placeholder.jpg';
    const imgAlt = (p.featuredImage?.altText || p.title).replace(/"/g, '&quot;');

    return `
      <article class="card">
        <a class="media" href="${productUrl}">
          <img src="${imgUrl}" alt="${imgAlt}">
        </a>
        <div class="content">
          <h3 class="title">${p.title}</h3>
          <div class="row"><span class="price">${price}</span></div>
          <div class="actions">
            <a class="btn" href="${productUrl}">View</a>
            <a class="btn primary" href="${addUrl}">Add to Cart</a>
          </div>
        </div>
      </article>`;
  }).join('');
}

/* === Newsletter (replace with Mailchimp/Beehiiv embed) === */
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    alert("Thanks — you're on the list.");
  });
}

/* === Init === */
loadCollection(COLLECTION_HANDLE);
