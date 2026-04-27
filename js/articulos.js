/* ============================================================
   CARDIOMET-LATAM · Articles page (articulos.html)
   Client-side filtering over 843 articles.
   ============================================================ */

(async function () {
  'use strict';

  const { fetchJSON } = window.CML;

  const listEl = document.getElementById('article-list');
  const countEl = document.getElementById('article-count');
  const countryFilter = document.getElementById('f-country');
  const designFilter = document.getElementById('f-design');
  const outcomeFilter = document.getElementById('f-outcome');
  const searchInput = document.getElementById('f-search');
  const openAccessFilter = document.getElementById('f-open');
  const resetBtn = document.getElementById('f-reset');

  if (!listEl) return;

  let articles = [];
  try {
    articles = await fetchJSON('data/articulos_compact.json');
  } catch (e) {
    listEl.innerHTML = '<li class="text-muted">No se pudo cargar la lista de artículos.</li>';
    return;
  }

  // Emoji flag for each country (matches country.js)
  const FLAGS = {
    'Argentina': '🇦🇷', 'Belice': '🇧🇿', 'Bolivia': '🇧🇴', 'Brasil': '🇧🇷',
    'Chile': '🇨🇱', 'Colombia': '🇨🇴', 'Costa Rica': '🇨🇷', 'Cuba': '🇨🇺',
    'Ecuador': '🇪🇨', 'El Salvador': '🇸🇻', 'Guatemala': '🇬🇹',
    'Guayana Francesa': '🇬🇫', 'Guyana': '🇬🇾', 'Honduras': '🇭🇳',
    'Jamaica': '🇯🇲', 'México': '🇲🇽', 'Nicaragua': '🇳🇮', 'Panamá': '🇵🇦',
    'Paraguay': '🇵🇾', 'Perú': '🇵🇪', 'Puerto Rico': '🇵🇷',
    'Republica Dominicana': '🇩🇴', 'Suriname': '🇸🇷', 'Uruguay': '🇺🇾',
    'Venezuela': '🇻🇪', 'Varios países': '🌎', 'Guayanas': '🌎',
  };
  function flagFor(pais) { return FLAGS[pais] || '🏳️'; }

  // Populate filter selects
  function populateSelect(el, values, placeholder, withFlags = false) {
    const opts = [`<option value="">${placeholder}</option>`]
      .concat(values.map(v => {
        const label = withFlags ? `${flagFor(v)}  ${v}` : v;
        return `<option value="${v}">${label}</option>`;
      }));
    el.innerHTML = opts.join('');
  }

  const countries = [...new Set(articles.map(a => a.pais).filter(Boolean))].sort();
  const designs   = [...new Set(articles.map(a => a.disenio).filter(Boolean))].sort();
  const outcomes  = [...new Set(articles.map(a => a.desenlace).filter(Boolean))].sort();

  populateSelect(countryFilter, countries, 'Todos los países', true);
  populateSelect(designFilter, designs, 'Todos los diseños');
  populateSelect(outcomeFilter, outcomes, 'Todos los desenlaces');

  // State
  const state = {
    pais: '',
    disenio: '',
    desenlace: '',
    search: '',
    openOnly: false,
    limit: 50,
  };

  // Read initial state from URL hash
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('pais'))     { state.pais = params.get('pais'); countryFilter.value = state.pais; }
    if (params.get('disenio'))  { state.disenio = params.get('disenio'); designFilter.value = state.disenio; }
    if (params.get('desenlace')){ state.desenlace = params.get('desenlace'); outcomeFilter.value = state.desenlace; }
    if (params.get('q'))        { state.search = params.get('q'); searchInput.value = state.search; }
  } catch (_) {}

  function matches(a) {
    if (state.pais && a.pais !== state.pais) return false;
    if (state.disenio && a.disenio !== state.disenio) return false;
    if (state.desenlace && a.desenlace !== state.desenlace) return false;
    if (state.openOnly && !a.libre_acceso) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const haystack = [
        a.titulo, a.autores, a.cita, a.factor_riesgo, a.factor_protector,
        ...(a.palabras_clave || [])
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderArticle(a) {
    const tags = [];
    if (a.disenio) tags.push(`<span class="article__tag">${escapeHtml(a.disenio)}</span>`);
    if (a.desenlace) tags.push(`<span class="article__tag">${escapeHtml(a.desenlace)}</span>`);

    const url = a.url || (a.doi ? `https://doi.org/${a.doi}` : null);
    const titleHtml = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(a.titulo)}</a>`
      : escapeHtml(a.titulo);

    return `
      <li class="article">
        <div class="article__meta">
          <div class="article__country">
            <span class="article__country-flag" aria-hidden="true">${flagFor(a.pais)}</span>
            <span class="article__country-name">${escapeHtml(a.pais || 'Sin país')}</span>
          </div>
          ${a.libre_acceso ? `<span class="pill pill--open">Acceso abierto</span>` : ''}
          ${a.cita ? `<div class="article__year">${escapeHtml((a.cita.match(/\d{4}/) || [''])[0])}</div>` : ''}
        </div>
        <div>
          <h3 class="article__title">${titleHtml}</h3>
          ${a.autores ? `<p class="article__authors">${escapeHtml(a.autores)}</p>` : ''}
          ${a.cita ? `<p class="article__cita">${escapeHtml(a.cita)}</p>` : ''}
          ${tags.length ? `<div class="article__tags">${tags.join('')}</div>` : ''}
        </div>
      </li>
    `;
  }

  function render() {
    const filtered = articles.filter(matches);
    countEl.innerHTML = `<strong>${filtered.length.toLocaleString('es-MX')}</strong> de ${articles.length.toLocaleString('es-MX')} artículos`;

    const toShow = filtered.slice(0, state.limit);
    if (!toShow.length) {
      listEl.innerHTML = '<li style="padding: 3rem 0; text-align: center; color: var(--ink-muted); font-style: italic;">Ningún artículo coincide con los filtros aplicados.</li>';
    } else {
      listEl.innerHTML = toShow.map(renderArticle).join('');
    }

    // "Show more" button
    const moreWrap = document.getElementById('load-more-wrap');
    if (moreWrap) {
      if (filtered.length > state.limit) {
        moreWrap.innerHTML = `
          <button class="btn btn--ghost" id="load-more">
            Ver más (${(filtered.length - state.limit).toLocaleString('es-MX')} restantes)
          </button>`;
        document.getElementById('load-more').addEventListener('click', () => {
          state.limit += 50;
          render();
        });
      } else {
        moreWrap.innerHTML = '';
      }
    }
  }

  // Wire events
  countryFilter.addEventListener('change', e => { state.pais = e.target.value; state.limit = 50; render(); });
  designFilter.addEventListener('change',  e => { state.disenio = e.target.value; state.limit = 50; render(); });
  outcomeFilter.addEventListener('change', e => { state.desenlace = e.target.value; state.limit = 50; render(); });
  if (openAccessFilter) openAccessFilter.addEventListener('change', e => { state.openOnly = e.target.checked; state.limit = 50; render(); });

  let searchTimer;
  searchInput.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.limit = 50;
      render();
    }, 200);
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.pais = state.disenio = state.desenlace = state.search = '';
      state.openOnly = false;
      state.limit = 50;
      countryFilter.value = designFilter.value = outcomeFilter.value = '';
      searchInput.value = '';
      if (openAccessFilter) openAccessFilter.checked = false;
      render();
    });
  }

  render();
})();
