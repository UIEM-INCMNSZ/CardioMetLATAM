/* ============================================================
   CARDIOMET-LATAM · Shared site JS
   - Injects header/footer on every page
   - Highlights active nav link
   - Provides fetchJSON utility with simple cache
   ============================================================ */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',             label: 'Inicio' },
    { href: 'mision-vision.html',     label: 'Misión y Visión' },
    { href: 'objetivos.html',         label: 'Objetivos' },
    { href: 'latinoamerica.html',     label: 'Latinoamérica' },
    { href: 'por-pais.html',          label: 'Por país' },
    { href: 'articulos.html',         label: 'Artículos' },
    { href: 'comite.html',            label: 'Comité' },
  ];

  function currentPage() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function renderHeader() {
    const current = currentPage();
    const links = NAV_LINKS.map(l => {
      const active = (l.href === current || (current === '' && l.href === 'index.html')) ? ' is-active' : '';
      return `<a href="${l.href}" class="${active.trim()}">${l.label}</a>`;
    }).join('');

    return `
      <header class="site-header">
        <div class="site-header__inner">
          <a href="index.html" class="brand" aria-label="CARDIOMET-LATAM · Inicio">
            <img src="assets/images/logo.svg" alt="" class="brand__logo">
            <span class="brand__text">
              <strong>CARDIOMET-LATAM</strong>
              <small>Salud cardiometabólica · Latinoamérica</small>
            </span>
          </a>
          <button class="nav__toggle" aria-expanded="false" aria-controls="primary-nav">Menú</button>
          <nav class="nav" id="primary-nav">${links}</nav>
        </div>
      </header>
    `;
  }

  function renderFooter() {
    return `
      <footer class="site-footer">
        <div class="site-footer__inner">
          <div>
            <h4>CARDIOMET-LATAM</h4>
            <p style="color: var(--ink-faint); font-size: .88rem; line-height: 1.55; max-width: 40ch;">
              Plataforma académica que reúne indicadores sociodemográficos y
              evidencia científica sobre salud cardiometabólica en América Latina.
              Instituto Nacional de Ciencias Médicas y Nutrición Salvador Zubirán.
            </p>
          </div>
          <div>
            <h4>Secciones</h4>
            <ul style="list-style: none; padding: 0; margin: 0; line-height: 2; font-size: .88rem;">
              <li><a href="latinoamerica.html">Latinoamérica</a></li>
              <li><a href="por-pais.html">Por país</a></li>
              <li><a href="articulos.html">Artículos</a></li>
            </ul>
          </div>
          <div>
            <h4>Institución</h4>
            <ul style="list-style: none; padding: 0; margin: 0; line-height: 2; font-size: .88rem;">
              <li><a href="mision-vision.html">Misión y Visión</a></li>
              <li><a href="objetivos.html">Objetivos</a></li>
              <li><a href="comite.html">Comité ejecutivo</a></li>
            </ul>
          </div>
        </div>
        <div class="site-footer__fine">
          <span>© ${new Date().getFullYear()} CARDIOMET-LATAM · INCMNSZ</span>
          <span>Todos los derechos reservados.</span>
        </div>
      </footer>
    `;
  }

  function mountChrome() {
    // Inject header at top of body
    const header = document.createElement('div');
    header.innerHTML = renderHeader();
    document.body.prepend(header.firstElementChild);

    // Append footer
    const footer = document.createElement('div');
    footer.innerHTML = renderFooter();
    document.body.appendChild(footer.firstElementChild);

    // Wire up mobile nav toggle
    const toggle = document.querySelector('.nav__toggle');
    const nav = document.querySelector('.nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    // Add scroll-state class to header (triggers stronger shadow when scrolled)
    const headerEl = document.querySelector('.site-header');
    if (headerEl) {
      const onScroll = () => {
        if (window.scrollY > 8) headerEl.classList.add('is-scrolled');
        else headerEl.classList.remove('is-scrolled');
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  // ----------------------------------------------------------
  // Data utilities
  // ----------------------------------------------------------
  const _cache = new Map();

  async function fetchJSON(url) {
    if (_cache.has(url)) return _cache.get(url);
    const p = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`${url} → ${r.status}`);
        return r.json();
      });
    _cache.set(url, p);
    return p;
  }

  // Number formatting (es-MX locale)
  const NF = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
  const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

  function formatValue(v, variable) {
    if (v == null || isNaN(v)) return '—';
    const abs = Math.abs(v);
    if (variable && /^POBLACION|MUERTES TOTALES|NACIMIENTOS/i.test(variable)) {
      return NF0.format(v);
    }
    if (abs >= 1000) return NF0.format(v);
    return NF.format(v);
  }

  // Variable display helpers
  function prettyVariable(v) {
    if (!v) return '';
    // Convert SHOUTING CAPS to Title Case but keep units/parens intact
    return v
      .replace(/\b(POR|DE|EN|AL|LA|EL|DEL)\b/g, m => m.toLowerCase())
      .replace(/\b([A-ZÁÉÍÓÚÑ])([A-ZÁÉÍÓÚÑ]+)\b/g, (_, a, b) => a + b.toLowerCase());
  }

  // Color palette for charts (matches design)
  const PALETTE = [
    '#0b4a5c', '#c04e2e', '#2d6a4f', '#7a5c3b',
    '#4b6072', '#a03e57', '#3d7a8c', '#b8803a',
    '#5c4a7e', '#256872', '#8c4a3d', '#4a7a5c',
    '#6c5c8c', '#a85c3a', '#3a6c8c', '#7c4a5c',
  ];

  // Export globals
  window.CML = {
    fetchJSON,
    formatValue,
    formatNumber: (v) => NF.format(v),
    formatNumber0: (v) => NF0.format(v),
    prettyVariable,
    PALETTE,
  };

  // Mount as soon as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountChrome);
  } else {
    mountChrome();
  }
})();
