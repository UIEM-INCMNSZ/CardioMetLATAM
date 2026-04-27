# CARDIOMET-LATAM

Versión estática del sitio [cardiometlatam.incmnsz.mx](https://cardiometlatam.incmnsz.mx/),
rediseñado para publicación en GitHub Pages sin dependencia de PHP, MySQL o
WordPress. Todos los tableros se reconstruyeron como visualizaciones
interactivas en JavaScript (Plotly.js) usando los datos del INCMNSZ.

## Estructura del proyecto

```
cardiomet-latam/
├── index.html                    # Inicio
├── latinoamerica.html            # 8 tableros regionales
├── por-pais.html                 # Directorio de países
├── country.html                  # Ficha por país (?pais=NOMBRE)
├── articulos.html                # Base de 843 artículos
├── mision-vision.html            # Misión y Visión
├── objetivos.html                # Objetivos
├── comite.html                   # Comité ejecutivo
├── css/
│   └── styles.css                # Sistema de diseño
├── js/
│   ├── site.js                   # Header/footer, utilidades
│   ├── dashboards.js             # Lógica de los 8 tableros
│   ├── articulos.js              # Filtros de artículos
│   └── country.js                # Página por país
└── data/
    ├── sociodemograficos.json    # Indicadores por país (25 países × 17 variables)
    ├── articulos.json            # 843 artículos con resúmenes
    ├── articulos_compact.json    # Mismo listado sin resúmenes (carga más rápido)
    └── regiones.json             # Agrupación por subregión geográfica
```

## Cómo desplegar en GitHub Pages

1. **Crear repositorio.** En GitHub, crear un repositorio nuevo llamado, por
   ejemplo, `cardiomet-latam`.

2. **Subir el código.** Desde la carpeta del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Versión estática inicial"
   git branch -M main
   git remote add origin https://github.com/USUARIO/cardiomet-latam.git
   git push -u origin main
   ```

3. **Activar Pages.** En GitHub: `Settings → Pages → Source → Deploy from a
   branch → main / (root) → Save`. A los pocos minutos el sitio quedará
   publicado en `https://USUARIO.github.io/cardiomet-latam/`.

4. **(Opcional) Dominio personalizado.** Para servir en
   `cardiometlatam.incmnsz.mx`, crear un archivo `CNAME` en la raíz con ese
   contenido y pedir a sistemas del INCMNSZ que apunten un registro CNAME al
   dominio de GitHub Pages.

## Cómo probar el sitio localmente

El sitio requiere un servidor HTTP (no funciona abriendo `index.html`
directamente, porque `fetch()` necesita HTTP). Desde la carpeta del proyecto:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node
npx serve .
```

Luego abrir `http://localhost:8000` en el navegador.

## Cómo actualizar los datos

Los tableros y la base de artículos se alimentan desde los archivos JSON en
la carpeta `data/`. Cuando el contenido de los Excel originales cambie,
hay que regenerar los JSON. El script de conversión está documentado en la
historia del proyecto — en resumen, toma los siguientes archivos como entrada:

- `SOCIODEMOGRÁFICOS_2025.xlsx` (hoja `sociodemograficos`, formato largo)
- `INGENIEROS.xlsx` (hoja `SECCIÓN ARTÍCULOS`)

Y produce los tres archivos JSON de la carpeta `data/`. Una vez regenerados,
simplemente `git commit` + `git push` y GitHub Pages reconstruye el sitio
automáticamente.

Si más adelante el equipo quiere automatizar este paso, es sencillo agregar
un GitHub Action que regenere los JSON cuando se suban nuevos Excel a una
carpeta `/source/`.

## Tecnología

- **Sin framework.** HTML, CSS y JavaScript vanilla. El sitio completo son
  ~25 KB de CSS + ~20 KB de JS + los datos JSON.
- **Fuentes:** Fraunces (Google Fonts) para títulos editoriales, Source Sans 3
  para cuerpo.
- **Visualizaciones:** [Plotly.js](https://plotly.com/javascript/) v2.35.2 desde
  CDN de plot.ly.
- **Sin tracking, sin cookies, sin backend.** El sitio funciona idéntico en
  GitHub Pages, Netlify, Vercel, o cualquier hosting estático.

## Pendientes

- Reemplazar los textos marcadores de posición en `mision-vision.html`,
  `objetivos.html` y `comite.html` con el contenido oficial aprobado.
- Añadir el logotipo institucional cuando esté disponible (sustituir el
  cuadrado con "C" en el header).
- Revisar las agrupaciones regionales de `data/regiones.json` con el criterio
  geográfico que prefiera el comité.
- A medida que se indexen más artículos o se actualicen indicadores,
  regenerar los JSON.

## Licencia y crédito

Contenido editorial y datos: © CARDIOMET-LATAM · INCMNSZ, todos los derechos
reservados. El código de la plataforma puede reutilizarse libremente.
