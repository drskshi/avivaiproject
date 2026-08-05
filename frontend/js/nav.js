/**
 * Shared header + mobile hamburger menu.
 */
function renderNav(active = '') {
  const user = Auth.getUser();
  const name = user ? `${user.firstName}` : null;

  const links = [
    { href: '/', label: 'Home', id: 'home' },
    { href: '/pages/tickets.html', label: 'Tickets', id: 'tickets' },
    { href: '/pages/cart.html', label: 'Cart', id: 'cart', badge: true },
    { href: '/pages/dashboard.html', label: 'My Tickets', id: 'dashboard' },
  ];

  if (user && user.role === 'admin') {
    links.push({ href: '/pages/admin.html', label: 'Admin', id: 'admin' });
  }

  const desktopLinks = links
    .map(
      (l) => `
      <a href="${l.href}" class="nav-link ${active === l.id ? 'active' : ''} inline-flex items-center gap-2">
        ${l.label}
        ${l.badge ? `<span data-cart-count class="badge badge-hot">0</span>` : ''}
      </a>`
    )
    .join('');

  const mobileLinks = links
    .map(
      (l) => `
      <a href="${l.href}" class="nav-link ${active === l.id ? 'active' : ''} flex items-center justify-between">
        <span>${l.label}</span>
        ${l.badge ? `<span data-cart-count class="badge badge-hot">0</span>` : ''}
      </a>`
    )
    .join('');

  const authBlock = user
    ? `<div class="flex items-center gap-2">
         <span class="hidden sm:inline text-sm text-slate-600">Hi, ${name}</span>
         <button id="logout-btn" type="button" class="btn-ghost text-sm px-3 py-2 min-h-0">Log out</button>
       </div>`
    : `<a href="/pages/auth.html" class="btn-primary text-sm px-4 py-2 min-h-0">Sign in</a>`;

  return `
  <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
      <a href="/" class="brand-mark text-lg sm:text-xl tracking-tight">O2 <span class="text-rose-600">TICKETS</span></a>

      <nav class="hidden md:flex items-center gap-1">${desktopLinks}</nav>

      <div class="flex items-center gap-2">
        ${authBlock}
        <button id="menu-toggle" type="button" class="md:hidden btn-ghost px-3 py-2 min-h-0" aria-label="Open menu" aria-expanded="false">
          <span class="block w-5 space-y-1.5">
            <span class="block h-0.5 bg-slate-800"></span>
            <span class="block h-0.5 bg-slate-800"></span>
            <span class="block h-0.5 bg-slate-800"></span>
          </span>
        </button>
      </div>
    </div>
    <div id="mobile-menu" class="md:hidden border-t border-slate-100 bg-white px-3 py-2 slide-down">
      ${mobileLinks}
    </div>
  </header>`;
}

function initNav(active) {
  const mount = document.getElementById('site-nav');
  if (!mount) return;
  mount.innerHTML = renderNav(active);

  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  const logout = document.getElementById('logout-btn');
  if (logout) {
    logout.addEventListener('click', () => {
      Auth.clear();
      window.location.href = '/';
    });
  }

  Cart.updateBadge();
}

window.initNav = initNav;
