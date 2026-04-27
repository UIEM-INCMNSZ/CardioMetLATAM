/* ============================================================
   CARDIOMET-LATAM · Dashboards v3
   - Only dashboards with actual data
   - Proper mobile-aware heights (no aplastamiento)
   - Variable names matching the JSON exactly (case-sensitive)
   ============================================================ */

(async function () {
  'use strict';

  function whenReady() {
    return new Promise(resolve => {
      if (window.Plotly && window.CML) return resolve();
      const t = setInterval(() => {
        if (window.Plotly && window.CML) { clearInterval(t); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(t); resolve(); }, 5000);
    });
  }

  await whenReady();
  if (!window.Plotly) {
    document.querySelectorAll('.dashboard__body').forEach(el => {
      el.innerHTML = '<p class="text-muted">La librería de gráficos no cargó. Verifique su conexión.</p>';
    });
    return;
  }

  const { fetchJSON, formatNumber0, PALETTE } = window.CML;

  let socio, regiones;
  try {
    [socio, regiones] = await Promise.all([
      fetchJSON('data/sociodemograficos.json'),
      fetchJSON('data/regiones.json'),
    ]);
  } catch (e) {
    console.error('Data load failed:', e);
    document.querySelectorAll('.dashboard__body').forEach(el => {
      el.innerHTML = '<p class="text-muted">No se pudieron cargar los datos.</p>';
    });
    return;
  }

  const { paises, datos } = socio;

  const countryRegion = {};
  for (const [region, list] of Object.entries(regiones)) {
    list.forEach(c => { countryRegion[c] = region; });
  }

  // ---- Mobile detection ------------------------------------------
  const isMobile = () => window.innerWidth <= 720;
  const isNarrow = () => window.innerWidth <= 420;

  // Outlier guard for population
  function adjustPopulation(v) {
    if (v == null || isNaN(v)) return v;
    return v > 400000 ? v / 1000 : v;
  }

  function valuesForVariable(variable, filterCountries = null) {
    const rows = [];
    const isPop = variable === 'POBLACION TOTAL (MILES)';
    for (const pais of (filterCountries || paises)) {
      const rec = datos[pais]?.[variable];
      if (rec && rec.valor != null && !isNaN(rec.valor)) {
        rows.push({
          pais,
          valor: isPop ? adjustPopulation(rec.valor) : rec.valor,
          anio: rec.anio,
          fuente: rec.fuente,
        });
      }
    }
    return rows;
  }

  function emptyMessage(el, msg) {
    el.innerHTML = `<p class="text-muted" style="text-align:center; padding: 2rem 1rem;">${msg}</p>`;
  }
  function clearLoading(el) {
    const loader = el.querySelector('.loading');
    if (loader) loader.remove();
  }

  // ---- Mobile-aware Plotly layout helper ------------------------
  function baseLayout(opts = {}) {
    const mobile = isMobile();
    return {
      font: {
        family: "'IBM Plex Sans', system-ui, sans-serif",
        color: '#2b3a46',
        size: mobile ? 11 : 13,
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: mobile
        ? { t: 20, r: 14, b: 70, l: 50 }
        : { t: 30, r: 20, b: 80, l: 80 },
      xaxis: {
        gridcolor: '#e8ebee',
        linecolor: '#d6dbdf',
        tickfont: { size: mobile ? 9 : 12 },
        automargin: true,
        ...(opts.xaxis || {}),
      },
      yaxis: {
        gridcolor: '#e8ebee',
        linecolor: '#d6dbdf',
        tickfont: { size: mobile ? 9 : 12 },
        zeroline: false,
        automargin: true,
        ...(opts.yaxis || {}),
      },
      hoverlabel: {
        bgcolor: '#0f1b24',
        bordercolor: '#0f1b24',
        font: { color: '#fbfaf6', family: "'IBM Plex Sans', sans-serif", size: 12 },
      },
      ...(opts.extras || {}),
    };
  }

  const config = { displayModeBar: false, responsive: true };

  // ---- Helper: set body min-height before drawing --------------
  function setBodyHeight(el, h) {
    el.style.minHeight = h + 'px';
    el.style.height = h + 'px';
  }

  // Re-render on viewport changes (debounced)
  const renderRegistry = [];
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderRegistry.forEach(fn => { try { fn(); } catch (e) {} });
    }, 250);
  });

  // ============================================================
  // SUMMARY (Dashboard 8 — top of page)
  // ============================================================
  function renderSummary() {
    const el = document.getElementById('dash-8');
    if (!el) return;

    const popRows = valuesForVariable('POBLACION TOTAL (MILES)');
    const gdpRows = valuesForVariable('PIB PER CÁPITA (US$ A PRECIOS ACTUALES)');
    const lifeRows = valuesForVariable('ESPERANZA DE VIDA AL NACER (AÑOS)');
    const mortRows = valuesForVariable('TASA DE MORTALIDAD (1000 HABITANTES)');

    const totalPop = popRows.reduce((s, r) => s + r.valor, 0) * 1000;
    const avgGdp = gdpRows.length ? gdpRows.reduce((s, r) => s + r.valor, 0) / gdpRows.length : null;
    const avgLife = lifeRows.length ? lifeRows.reduce((s, r) => s + r.valor, 0) / lifeRows.length : null;

    const mortSorted = [...mortRows].sort((a, b) => b.valor - a.valor);
    const maxMort = mortSorted[0] || null;
    const minMort = mortSorted[mortSorted.length - 1] || null;

    const card = (label, value, meta) => `
      <div class="stat" style="margin: 0;">
        <div class="stat__label">${label}</div>
        <div class="stat__value">${value}</div>
        <div class="stat__meta">${meta}</div>
      </div>`;

    let html = `<div class="grid grid--4" style="gap: 1rem;">`;
    html += card('Población total',
      popRows.length ? `${formatNumber0(totalPop / 1e6)}<sup>M</sup>` : '—',
      popRows.length ? `${popRows.length} países cubiertos` : 'sin datos');
    html += card('PIB per cápita · promedio',
      avgGdp != null ? `${formatNumber0(avgGdp)}<sup>USD</sup>` : '—',
      gdpRows.length ? `${gdpRows.length} países con dato` : 'sin datos');
    html += card('Esperanza de vida',
      avgLife != null ? `${avgLife.toFixed(1)}<sup>años</sup>` : '—',
      'Promedio regional');
    html += card('Tasa mort. más alta',
      maxMort ? maxMort.valor.toFixed(1) : '—',
      maxMort ? `${maxMort.pais} · por 1,000` : 'sin datos');
    html += `</div>`;

    if (minMort && maxMort && minMort !== maxMort && minMort.valor > 0) {
      html += `
        <hr class="rule" style="margin: 2rem 0 1.5rem;">
        <p class="text-muted text-small" style="margin: 0;">
          <strong>Observación.</strong> La tasa de mortalidad general varía de
          <strong>${minMort.valor.toFixed(1)}</strong> en <strong>${minMort.pais}</strong> a
          <strong>${maxMort.valor.toFixed(1)}</strong> en <strong>${maxMort.pais}</strong>
          (por 1,000 habitantes), reflejando diferencias estructurales entre los
          sistemas de salud y los determinantes sociodemográficos en la región.
        </p>`;
    }
    el.innerHTML = html;
  }

  // ============================================================
  // DASHBOARD 1 — Population
  // ============================================================
  function renderDash1() {
    const el = document.getElementById('dash-1');
    if (!el) return;
    const rows = valuesForVariable('POBLACION TOTAL (MILES)').sort((a, b) => b.valor - a.valor);
    if (!rows.length) return emptyMessage(el, 'Sin datos de población.');

    const mobile = isMobile();
    const rowH = mobile ? 22 : 28;
    const minH = mobile ? 480 : 520;
    const height = Math.max(minH, rows.length * rowH + 80);
    setBodyHeight(el, height);

    const trace = {
      type: 'bar', orientation: 'h',
      x: rows.map(r => r.valor),
      y: rows.map(r => r.pais),
      marker: {
        color: rows.map(r => {
          const regs = Object.keys(regiones);
          return PALETTE[regs.indexOf(countryRegion[r.pais]) % PALETTE.length];
        }),
      },
      hovertemplate: '<b>%{y}</b><br>%{x:,.1f} miles de habitantes<extra></extra>',
    };
    clearLoading(el);
    Plotly.newPlot(el, [trace], baseLayout({
      xaxis: { title: { text: mobile ? 'Miles de hab.' : 'Población total (miles de habitantes)', font: { size: mobile ? 10 : 12 } } },
    }), config);
  }

  // ============================================================
  // DASHBOARD 2 — Urban vs Rural composition
  // (Replaces sex-distribution which had cluttered data)
  // ============================================================
  function renderDash2() {
    const el = document.getElementById('dash-2');
    if (!el) return;
    const urb = valuesForVariable('POBLACIÓN URBANA (%)');
    const rur = valuesForVariable('POBLACIÓN RURAL (%)');
    if (!urb.length && !rur.length) return emptyMessage(el, 'Sin datos.');

    const countries = [...new Set([...urb.map(r => r.pais), ...rur.map(r => r.pais)])];
    const urbMap = Object.fromEntries(urb.map(r => [r.pais, r.valor]));
    const rurMap = Object.fromEntries(rur.map(r => [r.pais, r.valor]));
    // Sort by urban %
    countries.sort((a, b) => (urbMap[b] || 0) - (urbMap[a] || 0));

    const mobile = isMobile();
    const rowH = mobile ? 24 : 30;
    const height = Math.max(mobile ? 480 : 540, countries.length * rowH + 80);
    setBodyHeight(el, height);

    const traces = [
      {
        name: 'Urbano', type: 'bar', orientation: 'h',
        y: countries, x: countries.map(c => urbMap[c] || 0),
        marker: { color: '#0b4a5c' },
        hovertemplate: '<b>%{y}</b><br>Urbano: %{x:.1f}%<extra></extra>',
      },
      {
        name: 'Rural', type: 'bar', orientation: 'h',
        y: countries, x: countries.map(c => rurMap[c] || 0),
        marker: { color: '#c40101' },
        hovertemplate: '<b>%{y}</b><br>Rural: %{x:.1f}%<extra></extra>',
      },
    ];
    clearLoading(el);
    Plotly.newPlot(el, traces, baseLayout({
      xaxis: { title: { text: '% de la población', font: { size: mobile ? 10 : 12 } }, range: [0, 100] },
      extras: { barmode: 'stack', legend: { orientation: 'h', y: 1.06, x: 0, font: { size: mobile ? 10 : 12 } } },
    }), config);
  }

  // ============================================================
  // DASHBOARD 3 — GDP per capita
  // ============================================================
  function renderDash3() {
    const el = document.getElementById('dash-3');
    if (!el) return;
    const rows = valuesForVariable('PIB PER CÁPITA (US$ A PRECIOS ACTUALES)').sort((a, b) => b.valor - a.valor);
    if (!rows.length) return emptyMessage(el, 'Sin datos de PIB.');

    const mobile = isMobile();
    const rowH = mobile ? 26 : 32;
    const height = Math.max(mobile ? 380 : 440, rows.length * rowH + 80);
    setBodyHeight(el, height);

    const trace = {
      type: 'bar', orientation: 'h',
      x: rows.map(r => r.valor),
      y: rows.map(r => r.pais),
      marker: {
        color: rows.map(r => r.valor),
        colorscale: [[0, '#e6eef1'], [1, '#0b4a5c']],
        showscale: false,
      },
      hovertemplate: '<b>%{y}</b><br>PIB per cápita: US$%{x:,.0f}<extra></extra>',
    };
    clearLoading(el);
    Plotly.newPlot(el, [trace], baseLayout({
      xaxis: { title: { text: 'US$ a precios actuales', font: { size: mobile ? 10 : 12 } }, tickformat: ',' },
    }), config);
  }

  // ============================================================
  // DASHBOARD 4 — Life expectancy
  // ============================================================
  function renderDash4() {
    const el = document.getElementById('dash-4');
    if (!el) return;
    const rows = valuesForVariable('ESPERANZA DE VIDA AL NACER (AÑOS)').sort((a, b) => b.valor - a.valor);
    if (!rows.length) return emptyMessage(el, 'Sin datos.');

    const mobile = isMobile();
    const rowH = mobile ? 22 : 28;
    const height = Math.max(mobile ? 480 : 520, rows.length * rowH + 80);
    setBodyHeight(el, height);

    const trace = {
      type: 'bar', orientation: 'h',
      x: rows.map(r => r.valor),
      y: rows.map(r => r.pais),
      marker: { color: '#2d6a4f' },
      text: rows.map(r => r.valor.toFixed(1)),
      textposition: 'outside',
      textfont: { color: '#2b3a46', size: mobile ? 9 : 11 },
      hovertemplate: '<b>%{y}</b><br>%{x:.1f} años<extra></extra>',
    };
    clearLoading(el);
    Plotly.newPlot(el, [trace], baseLayout({
      xaxis: {
        title: { text: 'Años de esperanza de vida al nacer', font: { size: mobile ? 10 : 12 } },
        range: [55, 85],
      },
    }), config);
  }

  // ============================================================
  // DASHBOARD 5 — Mortality / natality (selector)
  // ============================================================
  function renderDash5() {
    const el = document.getElementById('dash-5');
    if (!el) return;
    const varOptions = [
      { key: 'TASA DE MORTALIDAD (1000 HABITANTES)', label: 'Tasa de mortalidad general (por 1,000 hab.)' },
      { key: 'TASA DE NATALIDAD (POR CADA 1000 HABITANTES)', label: 'Tasa de natalidad (por 1,000 hab.)' },
      { key: 'EDAD MEDIA', label: 'Edad media (años)' },
    ];

    const controls = el.closest('.dashboard').querySelector('.dashboard__controls');
    if (controls && !controls.dataset.mounted) {
      controls.innerHTML = `<label>Indicador
        <select id="dash5-var">${varOptions.map(o => `<option value="${o.key}">${o.label}</option>`).join('')}</select></label>`;
      controls.dataset.mounted = '1';
      document.getElementById('dash5-var').addEventListener('change', () => draw());
    }

    function draw() {
      const variable = document.getElementById('dash5-var')?.value || varOptions[0].key;
      const rows = valuesForVariable(variable).sort((a, b) => b.valor - a.valor);
      if (!rows.length) return emptyMessage(el, 'Sin datos para este indicador.');

      const mobile = isMobile();
      const rowH = mobile ? 22 : 28;
      const height = Math.max(mobile ? 480 : 520, rows.length * rowH + 80);
      setBodyHeight(el, height);

      const trace = {
        type: 'bar', orientation: 'h',
        x: rows.map(r => r.valor), y: rows.map(r => r.pais),
        marker: {
          color: rows.map(r => r.valor),
          colorscale: [[0, '#fbeaea'], [0.5, '#c40101'], [1, '#7a0202']],
          showscale: false,
        },
        hovertemplate: '<b>%{y}</b><br>%{x:,.2f}<extra></extra>',
      };
      clearLoading(el);
      Plotly.newPlot(el, [trace], baseLayout({
        xaxis: { title: { text: varOptions.find(o => o.key === variable).label, font: { size: mobile ? 10 : 12 } } },
      }), config);
    }
    draw();
    renderRegistry.push(draw);
  }

  // ============================================================
  // DASHBOARD 6 — Births vs Deaths (replaces failed CV scatter)
  // ============================================================
  function renderDash6() {
    const el = document.getElementById('dash-6');
    if (!el) return;
    const muertes = valuesForVariable('MUERTES TOTALES (MILES)');
    const nacim = valuesForVariable('NACIMIENTOS REGISTRADOS (MILES)');
    if (!muertes.length || !nacim.length) return emptyMessage(el, 'Sin datos suficientes.');

    const mMap = Object.fromEntries(muertes.map(r => [r.pais, r.valor]));
    const nMap = Object.fromEntries(nacim.map(r => [r.pais, r.valor]));
    const countries = [...new Set([...Object.keys(mMap), ...Object.keys(nMap)])]
      .filter(c => mMap[c] != null && nMap[c] != null && mMap[c] > 0 && nMap[c] > 0)
      .sort();
    if (!countries.length) return emptyMessage(el, 'Sin pares de datos válidos.');

    const mobile = isMobile();
    const height = mobile ? 460 : 520;
    setBodyHeight(el, height);

    const trace = {
      type: 'scatter', mode: 'markers+text',
      x: countries.map(c => mMap[c]),
      y: countries.map(c => nMap[c]),
      text: countries,
      textposition: 'top center',
      textfont: { size: mobile ? 8 : 10, color: '#2b3a46' },
      marker: {
        size: countries.map(c => Math.sqrt(mMap[c] + nMap[c]) * 1.2 + (mobile ? 6 : 10)),
        color: countries.map(c => nMap[c] / mMap[c]),
        colorscale: [[0, '#c40101'], [0.5, '#bc6c25'], [1, '#2d6a4f']],
        line: { color: '#0f1b24', width: 0.5 },
        showscale: !mobile,
        colorbar: !mobile ? {
          title: { text: 'Nac/Muert', font: { size: 11 } },
          thickness: 12, len: 0.5, x: 1.02,
        } : undefined,
      },
      hovertemplate: '<b>%{text}</b><br>Muertes: %{x:,.1f} mil<br>Nacimientos: %{y:,.1f} mil<extra></extra>',
    };
    clearLoading(el);
    Plotly.newPlot(el, [trace], baseLayout({
      xaxis: { title: { text: 'Muertes anuales (miles)', font: { size: mobile ? 10 : 12 } }, type: 'log' },
      yaxis: { title: { text: 'Nacimientos anuales (miles)', font: { size: mobile ? 10 : 12 } }, type: 'log' },
    }), config);
  }

  // ============================================================
  // DASHBOARD 7 — Regional comparison (boxplot)
  // ============================================================
  function renderDash7() {
    const el = document.getElementById('dash-7');
    if (!el) return;
    // Variables that have data + are interesting to compare regionally
    const varOptions = [
      { key: 'PIB PER CÁPITA (US$ A PRECIOS ACTUALES)', label: 'PIB per cápita (USD)' },
      { key: 'ESPERANZA DE VIDA AL NACER (AÑOS)', label: 'Esperanza de vida (años)' },
      { key: 'TASA DE MORTALIDAD (1000 HABITANTES)', label: 'Tasa de mortalidad (por 1,000)' },
      { key: 'TASA DE NATALIDAD (POR CADA 1000 HABITANTES)', label: 'Tasa de natalidad (por 1,000)' },
      { key: 'EDAD MEDIA', label: 'Edad media (años)' },
      { key: 'POBLACIÓN URBANA (%)', label: 'Población urbana (%)' },
    ];

    const controls = el.closest('.dashboard').querySelector('.dashboard__controls');
    if (controls && !controls.dataset.mounted) {
      controls.innerHTML = `<label>Indicador
        <select id="dash7-var">${varOptions.map(o => `<option value="${o.key}">${o.label}</option>`).join('')}</select></label>`;
      controls.dataset.mounted = '1';
      document.getElementById('dash7-var').addEventListener('change', () => draw());
    }

    function draw() {
      const variable = document.getElementById('dash7-var')?.value || varOptions[0].key;
      const traces = [];
      const regionNames = Object.keys(regiones);
      regionNames.forEach((reg, i) => {
        const rows = valuesForVariable(variable, regiones[reg]);
        if (!rows.length) return;
        traces.push({
          name: reg, type: 'box',
          y: rows.map(r => r.valor),
          text: rows.map(r => r.pais),
          boxpoints: 'all', jitter: 0.4, pointpos: 0,
          marker: { color: PALETTE[i], size: isMobile() ? 6 : 8 },
          line: { color: PALETTE[i] },
          hovertemplate: '<b>%{text}</b><br>%{y:,.1f}<extra></extra>',
        });
      });
      if (!traces.length) return emptyMessage(el, 'Sin datos para este indicador.');

      const mobile = isMobile();
      setBodyHeight(el, mobile ? 460 : 540);

      clearLoading(el);
      Plotly.newPlot(el, traces, baseLayout({
        xaxis: { tickangle: mobile ? -30 : -15 },
        yaxis: { title: { text: varOptions.find(o => o.key === variable).label, font: { size: mobile ? 10 : 12 } } },
        extras: { showlegend: false },
      }), config);
    }
    draw();
    renderRegistry.push(draw);
  }

  // Render in order ----------------------------------------------
  try {
    renderSummary();
    renderDash1();
    renderDash2();
    renderDash3();
    renderDash4();
    renderDash5();
    renderDash6();
    renderDash7();
  } catch (err) {
    console.error('Dashboard render error:', err);
  }

  // Re-render dashboards 1-4 on resize too (they have variable height)
  renderRegistry.push(renderDash1, renderDash2, renderDash3, renderDash4, renderDash6);
})();
