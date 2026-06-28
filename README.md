# MD2PDF

Professional Markdown to PDF converter with perfect LaTeX math rendering.

**Live Demo:** [https://your-username.github.io/md2pdf-site](https://your-username.github.io/md2pdf-site)

## Features

- **Perfect Math Rendering** — Full LaTeX support via MathJax 3 (amsmath, amssymb, mhchem, mathtools)
- **Code Highlighting** — 190+ languages via highlight.js
- **4 Themes** — Default, Academic, Minimal, Elegant
- **Chinese Support** — Optimized typography for CJK characters
- **Live Preview** — Real-time side-by-side editing
- **PDF Export** — High-quality output via browser print engine
- **No Server** — Runs entirely in the browser, no data leaves your device
- **Responsive** — Works on desktop and mobile

## Quick Start

### Local Development

Just open `index.html` in your browser. No build step, no dependencies to install.

```bash
# Or use any static file server
npx serve .
python -m http.server 8080
```

### Deploy to GitHub Pages

1. **Create a new GitHub repository**

   Go to [github.com/new](https://github.com/new), name it `md2pdf-site` (or any name you like).

2. **Push this project to GitHub**

   ```bash
   cd md2pdf-site
   git init
   git add .
   git commit -m "Initial commit: MD2PDF converter"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/md2pdf-site.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**

   - Go to your repo → **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Branch: **main**, folder: **/ (root)**
   - Click **Save**

4. **Access your site**

   Your site will be live at: `https://YOUR_USERNAME.github.io/md2pdf-site/`

   (It may take 1-2 minutes for the first deployment.)

### Custom Domain (Optional)

1. In your repo → **Settings** → **Pages** → **Custom domain**
2. Enter your domain (e.g., `md2pdf.example.com`)
3. Add a CNAME record pointing to `YOUR_USERNAME.github.io`
4. Enable **Enforce HTTPS**

## Project Structure

```
md2pdf-site/
├── index.html          # Main page
├── css/
│   └── style.css       # Styles (app layout + preview themes + print)
├── js/
│   └── app.js          # Core logic (parser, renderer, export, UI)
└── README.md
```

## How PDF Export Works

The PDF export uses the browser's native print engine:

1. Opens a new window with the rendered content
2. Embeds MathJax 3 for formula rendering
3. Waits for all math to finish rendering
4. Triggers the browser's print dialog
5. User selects "Save as PDF" as the destination

This approach ensures the **highest possible quality** for math formulas, because it uses the same rendering engine as the browser — no third-party PDF library can match this for complex LaTeX.

### Tips for Best PDF Output

- In the print dialog, select **"Save as PDF"** as the destination
- Set **Margins** to "Default" or "None" (the page CSS already handles margins)
- Enable **"Background graphics"** if you want code block backgrounds
- For A4 paper, make sure the paper size matches your selection

## Tech Stack

| Component | Technology | CDN |
|-----------|-----------|-----|
| Markdown Parser | [markdown-it](https://github.com/markdown-it/markdown-it) | jsDelivr |
| Math Rendering | [MathJax 3](https://www.mathjax.org/) | jsDelivr |
| Code Highlight | [highlight.js](https://highlightjs.org/) | cdnjs |
| PDF Export | Browser native print engine | — |
| Hosting | GitHub Pages | — |

## Supported Math

All standard LaTeX math is supported, including:

- Inline math: `$E = mc^2$`
- Display math: `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$`
- Environments: `aligned`, `cases`, `matrix`, `pmatrix`, `bmatrix`
- Packages: `amsmath`, `amssymb`, `mhchem` (chemistry), `mathtools`
- Equation numbering with `\tag{}` and `\label{}`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` | Export PDF |
| `Ctrl+O` | Open .md file |
| `Ctrl+S` | Save as .md |
| `Tab` | Insert 4 spaces |

## Browser Support

- Chrome / Edge 90+
- Firefox 90+
- Safari 15+

## License

MIT
