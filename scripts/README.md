# Automatización de datos · CARDIOMET-LATAM

Este repositorio sincroniza automáticamente los datos del sitio con dos
Google Sheets editables por el comité ejecutivo.

## Cómo funciona

```
┌────────────────────────┐         ┌──────────────────────────┐
│   Google Sheets        │         │   GitHub Actions         │
│                        │         │                          │
│  • Sociodemográficos   │ ──CSV──▶│  scripts/build_data.py   │
│  • Artículos           │         │  ↓                       │
│                        │         │  data/*.json             │
│  Editado por           │         │  ↓                       │
│  el comité (~10 pers.) │         │  commit + push           │
└────────────────────────┘         └──────────────────────────┘
                                             │
                                             ▼
                                   ┌──────────────────────────┐
                                   │   GitHub Pages           │
                                   │   El sitio se republica  │
                                   │   automáticamente.       │
                                   └──────────────────────────┘
```

## Cuándo se actualiza el sitio

- **Automáticamente** cada noche a las **3 AM hora de Ciudad de México** (09:00 UTC).
- **Manualmente**: ve a la pestaña **Actions** del repo, click **"Actualizar
  datos desde Google Sheets"**, y luego **"Run workflow"**. Tarda ~1 minuto.

## Qué pasa si hay un error

El script está diseñado para **fallar de forma segura**. Si una de las
siguientes cosas pasa:

- El Sheet no se puede descargar (Google está caído, URL roto, etc.)
- El Sheet tiene una columna renombrada o eliminada
- Una fila tiene datos malformados graves

…entonces **los archivos JSON existentes se quedan intactos** y el sitio
sigue mostrando la última versión válida. El build se reporta como fallido
en la pestaña Actions, pero el sitio sigue funcionando.

## Estructura de los Sheets esperada

### Sociodemográficos

Columnas requeridas:
- `pais` — nombre del país (texto)
- `variable` — nombre del indicador (texto, idealmente en MAYÚSCULAS)
- `valor` — valor numérico
- `valor2` — valor de texto (opcional, fallback cuando no aplica un número)
- `año` — año del dato (entero)
- `fuente` — fuente del dato (texto)

### Artículos

Columnas requeridas (case-insensitive):
- `PAÍS`, `TÍTULO`
- `EXCLUÍDO` (0 = incluir, 1 = excluir)
- `LIBRE ACCESO`, `AUTORES`, `CITA`, `DOI`, `URL`, `RESUMEN`,
  `PALABRAS CLAVE`, `DISEÑO DE ESTUDIO`, `DESENLACE`,
  `FACTOR DE RIESGO`, `FACTOR PROTECTOR`

Si renombras una columna en el Sheet, hay que actualizar `scripts/build_data.py`
para que la encuentre (o la reemplaces con el nombre original).

## Ejecutar localmente

Si quieres regenerar los JSON en tu computadora antes de hacer push:

```bash
pip install pandas requests
python scripts/build_data.py
```

## Cambiar las URLs de los Sheets

Las URLs están al inicio de `scripts/build_data.py`, en las constantes
`SOCIO_CSV_URL` y `ARTS_CSV_URL`. Si los Sheets cambian, edita esas dos
líneas.
