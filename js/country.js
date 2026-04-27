/* ============================================================
   CARDIOMET-LATAM · Por-país pages
   - por-pais.html: grid of countries with article counts
   - country.html?pais=NAME: detail view with indicators + articles
   ============================================================ */

(async function () {
  'use strict';

  const { fetchJSON, formatValue, formatNumber0 } = window.CML;

  // ---- Por-país landing grid --------------------------------
  const gridEl = document.getElementById('country-grid');

  // Emoji flag for each country in our dataset
  const FLAGS = {
    'Argentina': '🇦🇷',
    'Belice': '🇧🇿',
    'Bolivia': '🇧🇴',
    'Brasil': '🇧🇷',
    'Chile': '🇨🇱',
    'Colombia': '🇨🇴',
    'Costa Rica': '🇨🇷',
    'Cuba': '🇨🇺',
    'Ecuador': '🇪🇨',
    'El Salvador': '🇸🇻',
    'Guatemala': '🇬🇹',
    'Guayana Francesa': '🇬🇫',
    'Guyana': '🇬🇾',
    'Honduras': '🇭🇳',
    'Jamaica': '🇯🇲',
    'México': '🇲🇽',
    'Nicaragua': '🇳🇮',
    'Panamá': '🇵🇦',
    'Paraguay': '🇵🇾',
    'Perú': '🇵🇪',
    'Puerto Rico': '🇵🇷',
    'Republica Dominicana': '🇩🇴',
    'Suriname': '🇸🇷',
    'Uruguay': '🇺🇾',
    'Venezuela': '🇻🇪',
  };
  function flagFor(pais) { return FLAGS[pais] || '🏳️'; }

  if (gridEl) {
    const [socio, regiones, articles] = await Promise.all([
      fetchJSON('data/sociodemograficos.json'),
      fetchJSON('data/regiones.json'),
      fetchJSON('data/articulos_compact.json'),
    ]);
    const countryRegion = {};
    for (const [r, cs] of Object.entries(regiones)) cs.forEach(c => { countryRegion[c] = r; });
    const counts = articles.reduce((m, a) => { m[a.pais] = (m[a.pais] || 0) + 1; return m; }, {});

    // Order: by region, then alphabetical
    const tiles = socio.paises
      .map(p => ({ pais: p, region: countryRegion[p] || '—', count: counts[p] || 0 }))
      .sort((a, b) => a.region.localeCompare(b.region) || a.pais.localeCompare(b.pais));

    // Group tiles by region (in the order regions are defined in regiones.json)
    const byRegion = {};
    for (const region of Object.keys(regiones)) byRegion[region] = [];
    for (const pais of socio.paises) {
      const region = countryRegion[pais] || '—';
      if (!byRegion[region]) byRegion[region] = [];
      byRegion[region].push({ pais, count: counts[pais] || 0 });
    }
    // Sort countries alphabetically within each region
    for (const region of Object.keys(byRegion)) {
      byRegion[region].sort((a, b) => a.pais.localeCompare(b.pais));
    }

    // Render: a region heading followed by its tile grid, repeated
    gridEl.outerHTML = `
      <div class="regions">
        ${Object.entries(byRegion).filter(([_, list]) => list.length).map(([region, list]) => `
          <section class="region">
            <h2 class="region__title">${region}</h2>
            <div class="country-grid">
              ${list.map(t => `
                <a class="country-tile" href="country.html?pais=${encodeURIComponent(t.pais)}">
                  <div class="country-tile__flag" aria-hidden="true">${flagFor(t.pais)}</div>
                  <div>
                    <div class="country-tile__name">${t.pais}</div>
                    <div class="country-tile__region">${t.count} artículo${t.count === 1 ? '' : 's'}</div>
                  </div>
                </a>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    `;
    return;
  }

  // ---- Country detail ---------------------------------------
  const detailEl = document.getElementById('country-detail');
  if (!detailEl) return;

  const params = new URLSearchParams(location.search);
  const pais = params.get('pais');
  if (!pais) {
    detailEl.innerHTML = '<p>País no especificado. <a href="por-pais.html">Volver al listado</a>.</p>';
    return;
  }

  const [socio, regiones, articles] = await Promise.all([
    fetchJSON('data/sociodemograficos.json'),
    fetchJSON('data/regiones.json'),
    fetchJSON('data/articulos_compact.json'),
  ]);

  const datos = socio.datos[pais];
  if (!datos) {
    detailEl.innerHTML = `<p>No hay datos disponibles para <strong>${pais}</strong>. <a href="por-pais.html">Volver al listado</a>.</p>`;
    return;
  }

  const countryRegion = Object.entries(regiones).find(([_, cs]) => cs.includes(pais))?.[0] || '—';
  const countryArticles = articles.filter(a => a.pais === pais);

  // Set page title
  document.title = `${pais} · CARDIOMET-LATAM`;

  // Key indicators to highlight
  const keyVars = [
    { key: 'POBLACION TOTAL (MILES)', label: 'Población total', unit: 'mil hab.', scale: v => formatNumber0(v) },
    { key: 'ESPERANZA DE VIDA AL NACER (AÑOS)', label: 'Esperanza de vida', unit: 'años', scale: v => v.toFixed(1) },
    { key: 'PIB PER CÁPITA (US$ A PRECIOS ACTUALES)', label: 'PIB per cápita', unit: 'USD', scale: v => formatNumber0(v) },
    { key: 'TASA DE MORTALIDAD CARDIOVASCULAR (POR 100,000 HABITANTES)', label: 'Tasa mort. CV', unit: 'por 100k', scale: v => v.toFixed(1) },
  ];

  const statsHTML = keyVars.map(kv => {
    const rec = datos[kv.key];
    if (!rec || rec.valor == null) return `
      <div class="stat">
        <div class="stat__label">${kv.label}</div>
        <div class="stat__value" style="color: var(--ink-faint);">—</div>
        <div class="stat__meta">Sin dato</div>
      </div>`;
    return `
      <div class="stat">
        <div class="stat__label">${kv.label}</div>
        <div class="stat__value">${kv.scale(rec.valor)}<sup>${kv.unit}</sup></div>
        <div class="stat__meta">${rec.anio || ''}</div>
      </div>`;
  }).join('');

  // Full indicator table
  const allVarsHTML = Object.entries(datos)
    .filter(([_, rec]) => rec.valor != null || rec.texto)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variable, rec]) => {
      const val = rec.valor != null ? formatValue(rec.valor, variable) : (rec.texto || '—');
      return `
        <tr>
          <td style="padding: .6rem .8rem; border-bottom: 1px solid var(--rule-soft); font-size: .88rem;">${window.CML.prettyVariable(variable)}</td>
          <td style="padding: .6rem .8rem; border-bottom: 1px solid var(--rule-soft); font-family: var(--font-display); font-weight: 500;">${val}</td>
          <td style="padding: .6rem .8rem; border-bottom: 1px solid var(--rule-soft); font-size: .82rem; color: var(--ink-muted);">${rec.anio || '—'}</td>
        </tr>`;
    }).join('');

  // Articles summary
  const articlesHTML = countryArticles.length ? `
    <ul class="article-list">
      ${countryArticles.slice(0, 5).map(a => `
        <li class="article">
          <div class="article__meta">
            <div class="article__country">
              <span class="article__country-flag" aria-hidden="true">${flagFor(pais)}</span>
              <span class="article__country-name">${pais}</span>
            </div>
            ${a.libre_acceso ? `<span class="pill pill--open">Acceso abierto</span>` : ''}
            ${a.cita ? `<div class="article__year">${(a.cita.match(/\d{4}/) || [''])[0]}</div>` : ''}
          </div>
          <div>
            <h3 class="article__title">${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${a.titulo}</a>` : a.titulo}</h3>
            ${a.autores ? `<p class="article__authors">${a.autores}</p>` : ''}
            ${a.disenio ? `<div class="article__tags"><span class="article__tag">${a.disenio}</span>${a.desenlace ? `<span class="article__tag">${a.desenlace}</span>` : ''}</div>` : ''}
          </div>
        </li>`).join('')}
    </ul>
    ${countryArticles.length > 5 ? `
      <p style="margin-top: 1.5rem;">
        <a href="articulos.html?pais=${encodeURIComponent(pais)}" class="btn btn--ghost">
          Ver los ${countryArticles.length} artículos de ${pais} →
        </a>
      </p>` : ''}
  ` : '<p class="text-muted">No hay artículos indexados para este país todavía.</p>';

  detailEl.innerHTML = `
    <nav class="breadcrumb" style="padding-left:0; padding-right:0;">
      <a href="index.html">Inicio</a> ·
      <a href="por-pais.html">Por país</a> ·
      <span>${pais}</span>
    </nav>

    <header style="margin-bottom: 2rem; display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
      <div style="font-size: clamp(3.5rem, 10vw, 5rem); line-height: 1;" aria-hidden="true">${flagFor(pais)}</div>
      <div>
        <div class="section__label">${countryRegion}</div>
        <h1 style="font-size: clamp(2.5rem, 6vw, 4rem); margin: 0;">${pais}</h1>
      </div>
    </header>

    <div class="grid grid--4" style="gap: 1.5rem; margin-bottom: 3rem;">
      ${statsHTML}
    </div>

    <section style="margin-bottom: 3rem;">
      <h2 style="font-size: 1.5rem; border-bottom: 1px solid var(--rule); padding-bottom: .75rem;">Indicadores sociodemográficos</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--ink); text-align: left;">
              <th style="padding: .6rem .8rem; font-size: .75rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted);">Indicador</th>
              <th style="padding: .6rem .8rem; font-size: .75rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted);">Valor</th>
              <th style="padding: .6rem .8rem; font-size: .75rem; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-muted);">Año</th>
            </tr>
          </thead>
          <tbody>${allVarsHTML}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2 style="font-size: 1.5rem; border-bottom: 1px solid var(--rule); padding-bottom: .75rem;">
        Evidencia científica <span style="color: var(--ink-muted); font-size: .7em; font-weight: 400;">(${countryArticles.length} artículo${countryArticles.length === 1 ? '' : 's'})</span>
      </h2>
      ${articlesHTML}
    </section>
  `;
})();
