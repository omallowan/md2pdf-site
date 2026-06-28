/**
 * MathPDF - Core Application Logic
 *
 * Handles: Markdown parsing, math protection, live preview,
 *          PDF export, file I/O, themes, panel resize, persistence,
 *          analytics tracking, admin dashboard.
 */

(function () {
  'use strict';

  // ============================================================
  // Configuration
  // ============================================================

  const STORAGE_KEY = 'md2pdf-content';
  const THEME_KEY = 'md2pdf-theme';
  const PAPER_KEY = 'md2pdf-paper';
  const MARGIN_KEY = 'md2pdf-margin';
  const DEBOUNCE_MS = 300;
  const SAVE_DEBOUNCE_MS = 1000;

  const MARGIN_MAP = {
    narrow: '12mm 12mm',
    normal: '20mm 18mm',
    wide: '30mm 25mm'
  };

  // Default sample content
  const SAMPLE_MD = `# MathPDF — 在线 Markdown 转 PDF 工具

欢迎使用 **MathPDF**，一个专业的 Markdown 转 PDF 在线工具，完美渲染 LaTeX 数学公式。

---

## 核心特性

- **完美数学公式渲染**：基于 MathJax 3，支持行内公式、行间公式、矩阵、方程组等
- **中英文双语支持**：使用思源宋体，中英文混排效果优秀
- **代码高亮**：支持多种编程语言的语法高亮
- **多种主题**：默认、学术、简约、优雅四种预览主题
- **图片嵌入**：支持粘贴、拖放、选择文件三种方式插入图片
- **完全免费**：无需注册，无水印，所有功能免费使用

## 数学公式示例

### 行内公式

质能方程 $E = mc^2$，欧拉公式 $e^{i\\pi} + 1 = 0$。

### 行间公式

高斯积分：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

### 麦克斯韦方程组

$$
\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}
$$

$$
\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
$$

### 带编号的方程

$$
\\frac{\\partial u}{\\partial t} + (u \\cdot \\nabla) u = -\\frac{1}{\\rho} \\nabla p + \\nu \\nabla^2 u
\\tag{1}
$$

### 矩阵与行列式

$$
A = \\begin{pmatrix}
a_{11} & a_{12} & \\cdots & a_{1n} \\\\
a_{21} & a_{22} & \\cdots & a_{2n} \\\\
\\vdots & \\vdots & \\ddots & \\vdots \\\\
a_{m1} & a_{m2} & \\cdots & a_{mn}
\\end{pmatrix}
$$

### 分段函数

$$
f(x) = \\begin{cases}
x^2 & \\text{if } x > 0 \\\\
0 & \\text{if } x = 0 \\\\
-x^2 & \\text{if } x < 0
\\end{cases}
$$

## 代码示例

\`\`\`python
def fibonacci(n):
    """计算第 n 个斐波那契数"""
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
\`\`\`

## 表格示例

| 功能 | 状态 | 说明 |
|------|------|------|
| LaTeX 公式 | 完美支持 | MathJax 3 渲染 |
| 代码高亮 | 完美支持 | highlight.js |
| 中文排版 | 完美支持 | 思源宋体 |
| 图片嵌入 | 完美支持 | 粘贴/拖放/选择 |
| 主题切换 | 4 种 | 默认/学术/简约/优雅 |

## 如何使用

1. 在左侧编辑器中输入或粘贴 Markdown 内容
2. 右侧实时预览渲染效果
3. 点击右上角 **导出 PDF** 按钮下载 PDF 文件
4. 也可导出 HTML 或在浏览器中打开

> 所有转换均在浏览器本地完成，您的文件不会上传到任何服务器。

---

*开始编辑，或点击左上角 **打开** 按钮加载您的 .md 文件。*
`;

  // ============================================================
  // State
  // ============================================================

  let mdParser = null;
  let renderTimer = null;
  let saveTimer = null;
  let currentTheme = 'default';
  let currentPaper = 'A4';
  let currentMargin = 'normal';
  let isResizing = false;
  let loadedFileDir = null;  // Directory of the last opened .md file (for local image resolution)
  let loadedFileHandle = null; // File System Access API handle (if available)

  // Embedded image store: placeholder name -> base64 data URL
  // Editor shows short placeholders like ![pasted-image-1], rendering restores full data URIs
  const embeddedImages = new Map();
  let embeddedImageCounter = 0;

  // ============================================================
  // i18n (Chinese / English)
  // ============================================================

  const LANG_KEY = 'md2pdf-lang';
  let currentLang = 'zh'; // default to Chinese

  const i18n = {
    zh: {
      // Toolbar
      open: '打开',
      saveMd: '保存 .md',
      exportPdf: '导出 PDF',
      exportHtml: '导出 HTML',
      openBrowser: '浏览器打开',
      // Theme
      themeDefault: '默认',
      themeAcademic: '学术',
      themeMinimal: '简约',
      themeElegant: '优雅',
      // Paper
      paperA4: 'A4',
      paperLetter: 'Letter',
      paperLegal: 'Legal',
      // Margin
      marginNormal: '正常',
      marginNarrow: '窄',
      marginWide: '宽',
      // Status bar
      ctrlPExport: 'Ctrl+P 导出 PDF',
      // Preview placeholder
      previewPlaceholder1: '在左侧输入 Markdown 内容，预览将显示在这里。',
      previewPlaceholder2: '或点击 <strong>打开</strong> 加载 .md 文件。',
      // Panel hints
      editorHint: 'GFM、LaTeX 公式、代码块 | 粘贴或拖放图片可内嵌',
      // File operations
      nothingToExport: '没有可导出的内容，请先输入 Markdown 内容。',
      nothingToOpen: '没有可打开的内容，请先输入 Markdown 内容。',
      allowPopups: '请允许此网站的弹窗以导出 PDF。',
      allowPopupsBrowser: '请允许此网站的弹窗以在浏览器中打开。',
      // Image replacement overlay
      replaceImagesTitle: '替换本地图片',
      replaceImagesHint: '在此区域内粘贴图片 (Ctrl+V)',
      overlaySkip: '跳过',
      overlayCancel: '取消',
      overlayDone: '所有本地图片已处理完毕。',
      overlayAlt: '说明',
      overlayPath: '路径',
      overlayNone: '(无)',
      // Image folder prompt
      hasLocalImages: '文档中包含本地图片引用。\n\n是否选择图片文件夹以嵌入图片？\n点击"取消"将不嵌入图片。',
      hasLocalImagesBrowser: '文档中包含本地图片引用。\n\n是否选择图片文件夹以嵌入图片？\n点击"取消"将不显示图片。',
      // Open file with local images
      foundLocalImages: '在此文件中找到 {count} 个本地图片引用：\n\n{list}\n\n是否通过粘贴图片来替换它们？\n\n点击"确定"逐个替换图片。\n点击"取消"保留原始引用。',
      // Render status
      rendering: '渲染中...',
      rendered: '已渲染',
      renderError: '渲染错误',
      ready: '就绪',
      // Save
      saving: '保存中...',
      saved: '已保存',
      saveFailed: '保存失败',
      // Language
      langZh: '中文',
      langEn: 'English',
      // Feedback
      feedbackPrompt: 'MathPDF — 免费 · 无水印 · 专业数学公式渲染',
      feedbackLink: '反馈与建议',
      feedbackCopied: '邮箱已复制!',
      feedbackModalTitle: '联系我们',
      feedbackModalDesc: '如有问题或建议，欢迎通过邮件联系',
      feedbackModalCopied: '已复制到剪贴板!',
      feedbackModalCopy: '复制邮箱地址',
      // Insert image
      insertImage: '插入图片',
      // Download skill
      downloadSkill: '下载 Skill',
    },
    en: {
      open: 'Open',
      saveMd: 'Save .md',
      exportPdf: 'Export PDF',
      exportHtml: 'Export HTML',
      openBrowser: 'Open in Browser',
      themeDefault: 'Default',
      themeAcademic: 'Academic',
      themeMinimal: 'Minimal',
      themeElegant: 'Elegant',
      paperA4: 'A4',
      paperLetter: 'Letter',
      paperLegal: 'Legal',
      marginNormal: 'Normal',
      marginNarrow: 'Narrow',
      marginWide: 'Wide',
      ctrlPExport: 'Ctrl+P to export PDF',
      previewPlaceholder1: 'Start typing Markdown on the left to see the preview here.',
      previewPlaceholder2: 'Or click <strong>Open</strong> to load a .md file.',
      editorHint: 'GFM, LaTeX math, code blocks | Paste or drop images to embed',
      nothingToExport: 'Nothing to export. Please enter some Markdown content first.',
      nothingToOpen: 'Nothing to open. Please enter some Markdown content first.',
      allowPopups: 'Please allow pop-ups for this site to export PDF.',
      allowPopupsBrowser: 'Please allow pop-ups for this site to open content in a new tab.',
      replaceImagesTitle: 'Replace Local Images',
      replaceImagesHint: 'Paste image here (Ctrl+V)',
      overlaySkip: 'Skip',
      overlayCancel: 'Cancel',
      overlayDone: 'All local images have been processed.',
      overlayAlt: 'Alt',
      overlayPath: 'Path',
      overlayNone: '(none)',
      hasLocalImages: 'The document contains local image references.\n\nWould you like to select the image folder to embed images?\nClick "Cancel" to export without embedded images.',
      hasLocalImagesBrowser: 'The document contains local image references.\n\nWould you like to select the image folder to embed images?\nClick "Cancel" to open without images.',
      foundLocalImages: 'Found {count} local image reference(s) in this file:\n\n{list}\n\nWould you like to replace them by pasting images?\n\nClick OK to replace images one by one.\nClick Cancel to keep the original references.',
      rendering: 'Rendering...',
      rendered: 'Rendered',
      renderError: 'Render error',
      ready: 'Ready',
      saving: 'Saving...',
      saved: 'Saved',
      saveFailed: 'Save failed',
      langZh: '中文',
      langEn: 'English',
      // Feedback
      feedbackPrompt: 'MathPDF — Free · No Watermark · Perfect Math Rendering',
      feedbackLink: 'Feedback & Contact',
      feedbackCopied: 'Email copied!',
      feedbackModalTitle: 'Contact Us',
      feedbackModalDesc: 'For questions or suggestions, feel free to email us',
      feedbackModalCopied: 'Copied to clipboard!',
      feedbackModalCopy: 'Copy Email Address',
      // Insert image
      insertImage: 'Insert Image',
      // Download skill
      downloadSkill: 'Download Skill',
    }
  };

  function t(key) {
    const lang = i18n[currentLang] || i18n.zh;
    return lang[key] || key;
  }

  // Detect browser language
  function detectLanguage() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved) return saved;
    } catch (e) { /* ignore */ }
    const browserLang = navigator.language || navigator.userLanguage || '';
    return browserLang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  /**
   * Apply current language to all UI elements.
   */
  function applyLanguage() {
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (el.tagName === 'OPTION') {
        el.textContent = text;
      } else if (el.tagName === 'SPAN' || el.tagName === 'BUTTON' || el.tagName === 'LABEL') {
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });

    // Update render status
    if (renderStatus) renderStatus.textContent = t('ready');

    // Update language selector
    if (selLang) selLang.value = currentLang;
  }

  // ============================================================
  // DOM References
  // ============================================================

  const $ = (sel) => document.querySelector(sel);
  const editor = $('#editor');
  const preview = $('#preview');
  const renderStatus = $('#render-status');
  const statLines = $('#stat-lines');
  const statWords = $('#stat-words');
  const statChars = $('#stat-chars');
  const statSave = $('#stat-save');
  const selTheme = $('#sel-theme');
  const selPaper = $('#sel-paper');
  const selMargin = $('#sel-margin');
  const selLang = $('#sel-lang');
  const fileInput = $('#file-input');
  const resizeHandle = $('#resize-handle');
  const panelEditor = $('#panel-editor');
  const panelPreview = $('#panel-preview');
  const imageFolderInput = $('#image-folder-input');
  const imageInput = $('#image-input');

  // ============================================================
  // Math Protection (critical for correct rendering)
  // ============================================================

  /**
   * Extract all LaTeX math blocks from text, replace with safe ASCII placeholders.
   * Uses a unique marker pattern that won't be mangled by markdown-it or browsers.
   * Returns { text, blocks } where blocks is an array of { placeholder, original }.
   *
   * Order matters: display math ($$ and \[...\]) must be extracted before inline ($ and \(...\)).
   */
  function protectMath(text) {
    const blocks = [];
    let counter = 0;

    function save(match) {
      // Safe ASCII marker — no special chars, no backslashes, no null bytes
      const ph = `%%MD2PDF_MATH_${counter}%%`;
      blocks.push({ ph, original: match });
      counter++;
      return ph;
    }

    // Display math: $$...$$ (must come first)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, save);

    // Display math: \[...\]
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, save);

    // Inline math: $...$  (not preceded/followed by $, not empty)
    text = text.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, save);

    // Inline math: \(...\)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, save);

    return { text, blocks };
  }

  /**
   * Restore math blocks from placeholders.
   */
  function restoreMath(html, blocks) {
    for (const { ph, original } of blocks) {
      html = html.split(ph).join(original);
    }
    return html;
  }

  // ============================================================
  // Markdown Rendering
  // ============================================================

  function initParser() {
    mdParser = window.markdownit({
      html: true,
      linkify: false,  // Disable linkify to prevent interference with $ delimiters
      typographer: false,
      breaks: false,
      highlight: function (str, lang) {
        if (lang && window.hljs && window.hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
              window.hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
              '</code></pre>';
          } catch (_) { /* fallback */ }
        }
        return '<pre class="hljs"><code>' +
          mdParser.utils.escapeHtml(str) +
          '</code></pre>';
      }
    });
  }

  function renderMarkdown(mdText) {
    // Step 1: Protect math from markdown parser
    const { text: safeText, blocks } = protectMath(mdText);

    // Step 2: Restore embedded image placeholders to full markdown image syntax
    // Placeholder `![pasted-image-N]` must become `![pasted-image-N](dataUrl)`
    // so markdown-it can parse it as an <img> element.
    let textWithImages = safeText;
    for (const [placeholder, dataUrl] of embeddedImages) {
      textWithImages = textWithImages.split(placeholder).join(`${placeholder}(${dataUrl})`);
    }

    // Step 3: Parse markdown to HTML
    let html = mdParser.render(textWithImages);

    // Step 4: Restore math blocks
    html = restoreMath(html, blocks);

    // Step 5: Unwrap display math from <p> tags
    // markdown-it wraps standalone lines in <p>, but \[...\] display math
    // needs to be in a block-level container for MathJax to render \tag{} correctly
    html = html.replace(/<p>\s*(\\\[)/g, '<div class="math-display">$1');
    html = html.replace(/(\\\])\s*<\/p>/g, '$1</div>');

    // Step 6: Unwrap math from <code> tags
    // If user wrote `$E=mc^2$` inside backticks, markdown-it wraps it in <code>
    // MathJax skips <code> content, so we need to extract it
    html = html.replace(/<code>(\$[^$]+\$)<\/code>/g, '$1');
    html = html.replace(/<code>(\$\$[\s\S]*?\$\$)<\/code>/g, '$1');

    return html;
  }

  // ============================================================
  // Preview Update
  // ============================================================

  function updatePreview() {
    const mdText = editor.value;

    if (!mdText.trim()) {
      preview.innerHTML = `<div class="preview-placeholder"><p>${t('previewPlaceholder1')}</p><p>${t('previewPlaceholder2')}</p></div>`;
      updateStatus(0, 0, 0);
      return;
    }

    // Render
    const html = renderMarkdown(mdText);
    preview.innerHTML = html;

    // Typeset math with MathJax
    typesetMath().then(() => {
      if (renderStatus) renderStatus.textContent = t('rendered');
    }).catch(() => {
      if (renderStatus) renderStatus.textContent = t('renderError');
    });

    if (renderStatus) renderStatus.textContent = t('rendering');

    // Update stats
    updateStats(mdText);
  }

  function typesetMath() {
    return new Promise((resolve, reject) => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([preview]).then(resolve).catch(reject);
      } else {
        // MathJax not loaded yet, resolve immediately
        resolve();
      }
    });
  }

  function debouncedRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(updatePreview, DEBOUNCE_MS);
  }

  function debouncedSave() {
    clearTimeout(saveTimer);
    statSave.textContent = t('saving');
    statSave.className = 'stat-item stat-save saving';
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, editor.value);
        statSave.textContent = t('saved');
        statSave.className = 'stat-item stat-save saved';
        setTimeout(() => {
          statSave.textContent = '';
          statSave.className = 'stat-item stat-save';
        }, 2000);
      } catch (e) {
        statSave.textContent = t('saveFailed');
      }
    }, SAVE_DEBOUNCE_MS);
  }

  // ============================================================
  // Stats
  // ============================================================

  function updateStats(text) {
    const lines = text.split('\n').length;
    const chars = text.length;
    // Word count: split by whitespace, filter empty. For Chinese, count characters.
    const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
      .split(/\s+/).filter(w => w.length > 0).length;
    const words = englishWords + chineseChars;

    statLines.textContent = `Lines: ${lines}`;
    statWords.textContent = `Words: ${words}`;
    statChars.textContent = `Chars: ${chars}`;
  }

  // ============================================================
  // PDF Export (via print window)
  // ============================================================

  function exportPDF() {
    const mdText = editor.value;
    if (!mdText.trim()) {
      alert(t('nothingToExport'));
      return;
    }

    trackEvent('pdfExport');

    // Render content
    const html = renderMarkdown(mdText);
    const paperSize = currentPaper;
    const margin = MARGIN_MAP[currentMargin] || MARGIN_MAP.normal;
    const themeClass = currentTheme === 'default' ? '' : `theme-${currentTheme}`;

    // Build complete HTML document for the print window
    const printHTML = buildPrintDocument(html, paperSize, margin, themeClass);

    // Open new window
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) {
      alert(t('allowPopups'));
      return;
    }

    printWin.document.open();
    printWin.document.write(printHTML);
    printWin.document.close();

    // Wait for MathJax to fully finish in the print window
    waitForMathJax(printWin, 45000).then(() => {
      // Extra delay for fonts to settle and layout to stabilize
      setTimeout(() => {
        printWin.focus();
        printWin.print();
      }, 2000);
    });
  }

  function buildPrintDocument(htmlBody, paperSize, margin, themeClass) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>MathPDF Export</title>

<!-- MathJax 3 -->
<script>
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: { '[+]': ['amsmath', 'amssymb', 'mhchem'] },
    tags: 'ams'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
  startup: {
    pageReady: () => {
      return MathJax.startup.defaultPageReady().then(() => {
        document.body.classList.add('mathjax-done');
      });
    }
  }
};
<\/script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async><\/script>

<!-- highlight.js -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">

<style>
  /* ---------- Base ---------- */
  body {
    font-family: "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", "Songti SC",
                 "Latin Modern Roman", "Computer Modern Serif", Georgia, serif;
    color: #222;
    font-size: 11pt;
    line-height: 1.8;
    max-width: 100%;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* ---------- Typography ---------- */
  h1 {
    font-size: 1.6em; font-weight: 700;
    margin: 1.2em 0 0.5em; padding-bottom: 0.3em;
    border-bottom: 2px solid #333; color: #111;
    line-height: 1.3;
  }
  h1:first-child { margin-top: 0; }
  h2 {
    font-size: 1.3em; font-weight: 600;
    margin: 1.4em 0 0.5em; padding-bottom: 0.2em;
    border-bottom: 1px solid #ccc; color: #1a1a1a;
    line-height: 1.35;
  }
  h3 {
    font-size: 1.1em; font-weight: 600;
    margin: 1.5em 0 0.4em; color: #222;
  }
  h4, h5, h6 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: #333; }
  p { margin: 0.6em 0; }
  a { color: #1a5fb4; text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { font-weight: 700; color: #111; }

  blockquote {
    margin: 1em 0; padding: 0.6em 1.2em;
    border-left: 4px solid #ccc; background: #f7f7f5; color: #444;
    font-style: italic;
  }
  blockquote p { margin: 0.3em 0; }

  ul, ol { margin: 0.5em 0; padding-left: 2em; }
  li { margin: 0.25em 0; }

  hr { border: none; border-top: 1.5px solid #ccc; margin: 2em 0; }
  img { max-width: 100%; height: auto; margin: 1.2em 0; display: block; }

  /* ---------- Code ---------- */
  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace;
    font-size: 0.85em; background: #f0f0f0; padding: 2px 6px;
    border-radius: 3px; color: #b5204a;
  }
  pre {
    margin: 1.2em 0; padding: 16px 20px; background: #f8f8f8;
    border-radius: 6px; overflow-x: auto; border: 1px solid #e4e4e4;
    line-height: 1.5;
  }
  pre code { background: none; padding: 0; color: inherit; font-size: 0.85em; line-height: 1.55; }

  /* ---------- Tables ---------- */
  table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: 0.9em; }
  th, td { border: 1px solid #bbb; padding: 8px 14px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; color: #222; }
  tr:nth-child(even) { background: #fafafa; }

  /* ---------- Math (MathJax CHTML) ---------- */
  mjx-container {
    font-size: 105% !important;
  }
  mjx-container[jax="CHTML"][display="true"] {
    margin: 1.2em 0 !important;
    overflow: visible !important;
  }
  /* Ensure display math inside <p> tags breaks properly */
  p > mjx-container[jax="CHTML"][display="true"] {
    display: block !important;
    margin: 1.2em 0 !important;
    text-align: center;
  }
  /* Boxed equations */
  mjx-container .mjx-mbox {
    padding: 2px 4px;
  }
  /* Ensure tags are visible */
  mjx-container .mjx-mtable {
    overflow: visible !important;
  }
  /* Display math block container */
  .math-display {
    margin: 1.2em 0;
    text-align: center;
  }

  /* ---------- Print ---------- */
  @page { size: ${paperSize}; margin: ${margin}; }

  h1, h2, h3, h4, h5, h6 { page-break-after: avoid; break-after: avoid; }
  pre, blockquote, table, img { page-break-inside: avoid; break-inside: avoid; }
  mjx-container[jax="CHTML"][display="true"] { page-break-inside: avoid; break-inside: avoid; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
  img { max-width: 100% !important; }

  ${getThemePrintCSS(themeClass)}
</style>
</head>
<body class="tex2jax_process">
${htmlBody}
</body>
</html>`;
  }

  /**
   * Get theme-specific print CSS.
   */
  function getThemePrintCSS(themeClass) {
    if (themeClass === 'theme-academic') {
      return `
        body {
          line-height: 1.9;
        }
        h1 { border-bottom-color: #333; }
        h2 { border-bottom-color: #999; }
        code { background: #f0f0f0; color: #8b0000; }
        pre { background: #f8f8f8; border-color: #ddd; }
        blockquote { border-left-color: #999; background: #f5f5f0; font-style: italic; }
        a { color: #0033cc; }
      `;
    }
    if (themeClass === 'theme-minimal') {
      return `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
          color: #24292f; line-height: 1.7;
        }
        h1, h2 { border-bottom: none; color: #24292f; }
        code { background: #eff1f3; color: #24292f; border-radius: 6px; }
        pre { background: #eff1f3; border: none; border-radius: 6px; }
        blockquote { border-left-color: #d0d7de; background: transparent; color: #57606a; }
        a { color: #0969da; }
      `;
    }
    if (themeClass === 'theme-elegant') {
      return `
        body {
          font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
          color: #2c3e50; line-height: 1.85;
        }
        h1 { border-bottom: 3px double #2c3e50; letter-spacing: 1px; }
        h2 { border-bottom-color: #bdc3c7; }
        code { background: #ecf0f1; color: #c0392b; }
        pre { background: #2c3e50; color: #ecf0f1; }
        pre code { background: none; color: #ecf0f1; }
        blockquote { border-left-color: #2c3e50; font-style: italic; }
        a { color: #2980b9; border-bottom: 1px solid #2980b9; }
      `;
    }
    return '';
  }

  /**
   * Wait for MathJax in the print window to finish rendering.
   */
  function waitForMathJax(win, maxWait = 30000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        try {
          if (win.document.body && win.document.body.classList.contains('mathjax-done')) {
            resolve();
            return;
          }
        } catch (e) {
          // Cross-origin or window closed
        }
        if (Date.now() - start > maxWait) {
          resolve(); // Timeout, proceed anyway
          return;
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  // ============================================================
  // Standalone HTML Export & Open in Browser
  // ============================================================

  /**
   * Build a standalone HTML document for screen viewing (no @page rules).
   * Includes MathJax CDN, highlight.js CDN, and all CSS inline.
   */
  function buildStandaloneHTML(htmlBody, themeClass) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MathPDF Export</title>

<!-- MathJax 3 -->
<script>
window.MathJax = {
  tex: {
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true,
    processEnvironments: true,
    packages: { '[+]': ['amsmath', 'amssymb', 'mhchem'] },
    tags: 'ams'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
  startup: {
    pageReady: () => {
      return MathJax.startup.defaultPageReady().then(() => {
        document.body.classList.add('mathjax-done');
      });
    }
  }
};
<\/script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async><\/script>

<!-- highlight.js -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">

<style>
  /* ---------- Base ---------- */
  body {
    font-family: "Source Han Serif SC", "Noto Serif CJK SC", "SimSun", "Songti SC",
                 "Latin Modern Roman", "Computer Modern Serif", Georgia, serif;
    color: #222;
    font-size: 15px;
    line-height: 1.8;
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 24px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #fff;
  }

  /* ---------- Typography ---------- */
  h1 {
    font-size: 1.6em; font-weight: 700;
    margin: 1.2em 0 0.5em; padding-bottom: 0.3em;
    border-bottom: 2px solid #333; color: #111;
    line-height: 1.3;
  }
  h1:first-child { margin-top: 0; }
  h2 {
    font-size: 1.3em; font-weight: 600;
    margin: 1.4em 0 0.5em; padding-bottom: 0.2em;
    border-bottom: 1px solid #ccc; color: #1a1a1a;
    line-height: 1.35;
  }
  h3 {
    font-size: 1.1em; font-weight: 600;
    margin: 1.5em 0 0.4em; color: #222;
  }
  h4, h5, h6 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: #333; }
  p { margin: 0.6em 0; }
  a { color: #1a5fb4; text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { font-weight: 700; color: #111; }

  blockquote {
    margin: 1em 0; padding: 0.6em 1.2em;
    border-left: 4px solid #ccc; background: #f7f7f5; color: #444;
    font-style: italic;
  }
  blockquote p { margin: 0.3em 0; }

  ul, ol { margin: 0.5em 0; padding-left: 2em; }
  li { margin: 0.25em 0; }

  hr { border: none; border-top: 1.5px solid #ccc; margin: 2em 0; }
  img { max-width: 100%; height: auto; margin: 1.2em 0; display: block; }

  /* ---------- Code ---------- */
  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace;
    font-size: 0.85em; background: #f0f0f0; padding: 2px 6px;
    border-radius: 3px; color: #b5204a;
  }
  pre {
    margin: 1.2em 0; padding: 16px 20px; background: #f8f8f8;
    border-radius: 6px; overflow-x: auto; border: 1px solid #e4e4e4;
    line-height: 1.5;
  }
  pre code { background: none; padding: 0; color: inherit; font-size: 0.85em; line-height: 1.55; }

  /* ---------- Tables ---------- */
  table { width: 100%; border-collapse: collapse; margin: 1.2em 0; font-size: 0.9em; }
  th, td { border: 1px solid #bbb; padding: 8px 14px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; color: #222; }
  tr:nth-child(even) { background: #fafafa; }

  /* ---------- Math (MathJax CHTML) ---------- */
  mjx-container {
    font-size: 105% !important;
  }
  mjx-container[jax="CHTML"][display="true"] {
    margin: 1.2em 0 !important;
    overflow: visible !important;
  }
  p > mjx-container[jax="CHTML"][display="true"] {
    display: block !important;
    margin: 1.2em 0 !important;
    text-align: center;
  }
  mjx-container .mjx-mbox {
    padding: 2px 4px;
  }
  mjx-container .mjx-mtable {
    overflow: visible !important;
  }
  .math-display {
    margin: 1.2em 0;
    text-align: center;
  }

  ${getThemeScreenCSS(themeClass)}
</style>
</head>
<body class="tex2jax_process">
${htmlBody}
</body>
</html>`;
  }

  /**
   * Get theme-specific screen CSS (for standalone HTML).
   */
  function getThemeScreenCSS(themeClass) {
    if (themeClass === 'theme-academic') {
      return `
        body { line-height: 1.9; }
        h1 { border-bottom-color: #333; }
        h2 { border-bottom-color: #999; }
        code { background: #f0f0f0; color: #8b0000; }
        pre { background: #f8f8f8; border-color: #ddd; }
        blockquote { border-left-color: #999; background: #f5f5f0; font-style: italic; }
        a { color: #0033cc; }
      `;
    }
    if (themeClass === 'theme-minimal') {
      return `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
          color: #24292f; line-height: 1.7;
        }
        h1, h2 { border-bottom: none; color: #24292f; }
        code { background: #eff1f3; color: #24292f; border-radius: 6px; }
        pre { background: #eff1f3; border: none; border-radius: 6px; }
        blockquote { border-left-color: #d0d7de; background: transparent; color: #57606a; }
        a { color: #0969da; }
      `;
    }
    if (themeClass === 'theme-elegant') {
      return `
        body {
          font-family: 'Georgia', 'Noto Serif SC', 'Source Han Serif SC', serif;
          color: #2c3e50; line-height: 1.85;
        }
        h1 { border-bottom: 3px double #2c3e50; letter-spacing: 1px; }
        h2 { border-bottom-color: #bdc3c7; }
        code { background: #ecf0f1; color: #c0392b; }
        pre { background: #2c3e50; color: #ecf0f1; }
        pre code { background: none; color: #ecf0f1; }
        blockquote { border-left-color: #2c3e50; font-style: italic; }
        a { color: #2980b9; border-bottom: 1px solid #2980b9; }
      `;
    }
    return '';
  }

  /**
   * Resolve local image paths in HTML by converting them to base64 data URIs.
   * Uses files from the user-selected image folder.
   * Returns a Promise that resolves to the updated HTML string.
   */
  async function resolveLocalImages(html, imageFiles) {
    if (!imageFiles || imageFiles.length === 0) return html;

    // Build a map: relative path -> File object
    const fileMap = new Map();
    for (const file of imageFiles) {
      // webkitRelativePath is like "folder/subfolder/image.png"
      const relPath = file.webkitRelativePath || file.name;
      // Map by filename (for simple matching)
      fileMap.set(file.name, file);
      // Also map by the relative path
      fileMap.set(relPath, file);
      // Map by forward-slash version (for cross-platform)
      fileMap.set(relPath.replace(/\\/g, '/'), file);
    }

    // Find all <img> tags with src attributes
    const imgRegex = /<img\s+[^>]*src="([^"]*)"[^>]*>/gi;
    const matches = [...html.matchAll(imgRegex)];

    for (const match of matches) {
      const fullTag = match[0];
      const src = match[1];

      // Skip already-embedded images (data URIs) and remote URLs
      if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
        continue;
      }

      // Try to find the file in the map
      let file = null;

      // Try exact match
      file = fileMap.get(src);

      // Try just the filename
      if (!file) {
        const filename = src.replace(/\\/g, '/').split('/').pop();
        file = fileMap.get(filename);
      }

      // Try with forward slashes
      if (!file) {
        const normalized = src.replace(/\\/g, '/');
        file = fileMap.get(normalized);
      }

      // Try matching the tail of any relative path
      if (!file) {
        const normalized = src.replace(/\\/g, '/');
        for (const [key, val] of fileMap) {
          if (key.replace(/\\/g, '/').endsWith(normalized)) {
            file = val;
            break;
          }
        }
      }

      if (file) {
        try {
          const dataUrl = await fileToDataUrl(file);
          html = html.replace(fullTag, fullTag.replace(src, dataUrl));
        } catch (e) {
          console.warn('Failed to embed image:', src, e);
        }
      }
    }

    return html;
  }

  /**
   * Convert a File object to a base64 data URL.
   */
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Export the rendered content as a standalone .html file.
   * If local images are detected and an image folder has been selected,
   * images will be embedded as base64 data URIs.
   */
  async function exportHTML() {
    const mdText = editor.value;
    if (!mdText.trim()) {
      alert(t('nothingToExport'));
      return;
    }

    let html = renderMarkdown(mdText);
    const themeClass = currentTheme === 'default' ? '' : `theme-${currentTheme}`;

    // Check for local images
    const hasLocalImages = /<img\s+[^>]*src="(?!data:|https?:\/\/)[^"]*"[^>]*>/i.test(html);

    if (hasLocalImages && cachedImageFiles.length > 0) {
      html = await resolveLocalImages(html, cachedImageFiles);
    } else if (hasLocalImages) {
      const shouldSelect = confirm(t('hasLocalImages'));
      if (shouldSelect) {
        // Trigger folder selection, then export
        pendingExportHTML = { html, themeClass };
        imageFolderInput.click();
        return;
      }
    }

    doExportHTML(html, themeClass);
  }

  let pendingExportHTML = null;
  let cachedImageFiles = [];

  function doExportHTML(html, themeClass) {
    trackEvent('htmlExport');
    const fullHTML = buildStandaloneHTML(html, themeClass);
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open the rendered content in a new browser tab.
   * If local images are detected and an image folder has been selected,
   * images will be embedded as base64 data URIs.
   */
  async function openInBrowser() {
    const mdText = editor.value;
    if (!mdText.trim()) {
      alert(t('nothingToOpen'));
      return;
    }

    let html = renderMarkdown(mdText);
    const themeClass = currentTheme === 'default' ? '' : `theme-${currentTheme}`;

    // Check for local images
    const hasLocalImages = /<img\s+[^>]*src="(?!data:|https?:\/\/)[^"]*"[^>]*>/i.test(html);

    if (hasLocalImages && cachedImageFiles.length > 0) {
      html = await resolveLocalImages(html, cachedImageFiles);
    } else if (hasLocalImages) {
      const shouldSelect = confirm(t('hasLocalImagesBrowser'));
      if (shouldSelect) {
        pendingOpenBrowser = { html, themeClass };
        imageFolderInput.click();
        return;
      }
    }

    doOpenInBrowser(html, themeClass);
  }

  let pendingOpenBrowser = null;

  function doOpenInBrowser(html, themeClass) {
    trackEvent('browserOpen');
    const fullHTML = buildStandaloneHTML(html, themeClass);
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert(t('allowPopupsBrowser'));
      return;
    }
    printWin.document.open();
    printWin.document.write(fullHTML);
    printWin.document.close();
  }

  /**
   * Handle image folder selection (for embedding local images).
   */
  function handleImageFolderSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    cachedImageFiles = files;

    // If there's a pending export or browser open, complete it now
    if (pendingExportHTML) {
      const { html, themeClass } = pendingExportHTML;
      pendingExportHTML = null;
      resolveLocalImages(html, files).then(resolvedHtml => {
        doExportHTML(resolvedHtml, themeClass);
      });
    } else if (pendingOpenBrowser) {
      const { html, themeClass } = pendingOpenBrowser;
      pendingOpenBrowser = null;
      resolveLocalImages(html, files).then(resolvedHtml => {
        doOpenInBrowser(resolvedHtml, themeClass);
      });
    }

    // Reset input
    imageFolderInput.value = '';
  }

  // ============================================================
  // File I/O
  // ============================================================

  function openFile() {
    fileInput.click();
  }

  function handleFileOpen(e) {
    const file = e.target.files[0];
    if (!file) return;

    trackEvent('fileOpen');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      editor.value = text;

      // Check for local image references
      const localImages = findLocalImages(text);
      if (localImages.length > 0) {
        const imgList = localImages.map((img, i) => `  ${i + 1}. ${img.alt || t('overlayNone')} → ${img.src}`).join('\n');
        const msg = t('foundLocalImages')
          .replace('{count}', localImages.length)
          .replace('{list}', imgList);
        const shouldReplace = confirm(msg);
        if (shouldReplace) {
          replaceLocalImagesSequentially(localImages);
        }
      }

      updatePreview();
      debouncedSave();
    };
    reader.readAsText(file, 'UTF-8');

    // Reset input so same file can be opened again
    fileInput.value = '';
  }

  /**
   * Find all local image references in Markdown text.
   * Returns an array of { alt, src, fullMatch, index } objects.
   * "Local" means not a data: URI and not http(s)://.
   */
  function findLocalImages(text) {
    const results = [];
    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const alt = match[1];
      const src = match[2];
      if (!src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        results.push({
          alt,
          src,
          fullMatch: match[0],
          index: match.index
        });
      }
    }
    return results;
  }

  /**
   * Replace local image references one by one using a visual overlay.
   * The overlay has a dedicated paste area — user pastes directly in the dialog.
   */
  function replaceLocalImagesSequentially(localImages) {
    let currentIndex = 0;

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'image-replace-overlay';
    overlay.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="overlay-content">
        <h3 id="overlay-title">${t('replaceImagesTitle')}</h3>
        <div class="overlay-info" id="overlay-info"></div>
        <div class="overlay-paste-area" id="overlay-paste-area" tabindex="0">
          <div class="paste-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </div>
          <div class="paste-text" id="overlay-paste-text">${t('replaceImagesHint')}</div>
          <img class="paste-preview" id="overlay-paste-preview" style="display:none" />
        </div>
        <div class="overlay-actions">
          <button id="overlay-skip" class="overlay-btn">${t('overlaySkip')}</button>
          <button id="overlay-cancel" class="overlay-btn overlay-btn-cancel">${t('overlayCancel')}</button>
        </div>
        <div class="overlay-progress" id="overlay-progress"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Style the overlay
    const style = document.createElement('style');
    style.id = 'image-replace-overlay-style';
    style.textContent = `
      #image-replace-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 10000; display: flex; align-items: center; justify-content: center;
      }
      #image-replace-overlay .overlay-backdrop {
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
      }
      #image-replace-overlay .overlay-content {
        position: relative; z-index: 1;
        background: #1e1e2e; color: #cdd6f4;
        border: 1px solid #45475a; border-radius: 12px;
        padding: 28px 32px; max-width: 480px; width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      #image-replace-overlay h3 {
        margin: 0 0 16px; font-size: 16px; color: #89b4fa;
      }
      #image-replace-overlay .overlay-info {
        background: #181825; border-radius: 8px; padding: 12px 16px;
        margin-bottom: 16px; font-size: 13px; line-height: 1.6;
        border: 1px solid #313244;
      }
      #image-replace-overlay .overlay-info .img-path {
        color: #f38ba8; word-break: break-all; font-family: monospace; font-size: 12px;
      }
      #image-replace-overlay .overlay-paste-area {
        border: 2px dashed #45475a; border-radius: 10px;
        padding: 24px 16px; margin-bottom: 16px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s;
        background: rgba(137,180,250,0.03);
        outline: none;
        min-height: 100px;
      }
      #image-replace-overlay .overlay-paste-area:hover,
      #image-replace-overlay .overlay-paste-area:focus {
        border-color: #89b4fa; background: rgba(137,180,250,0.08);
      }
      #image-replace-overlay .overlay-paste-area.has-image {
        border-color: #a6e3a1; background: rgba(166,227,161,0.08);
      }
      #image-replace-overlay .paste-icon {
        color: #6c7086; margin-bottom: 8px;
      }
      #image-replace-overlay .paste-text {
        font-size: 13px; color: #a6adc8;
      }
      #image-replace-overlay .paste-preview {
        max-width: 200px; max-height: 120px; border-radius: 6px;
        margin-top: 8px; object-fit: contain;
      }
      #image-replace-overlay .overlay-actions {
        display: flex; gap: 8px; justify-content: flex-end;
      }
      #image-replace-overlay .overlay-btn {
        padding: 6px 16px; border: 1px solid #45475a; border-radius: 6px;
        background: #313244; color: #cdd6f4; cursor: pointer; font-size: 13px;
        transition: all 0.15s;
      }
      #image-replace-overlay .overlay-btn:hover { background: #45475a; }
      #image-replace-overlay .overlay-btn-cancel { color: #f38ba8; border-color: #f38ba8; }
      #image-replace-overlay .overlay-btn-cancel:hover { background: rgba(243,139,168,0.15); }
      #image-replace-overlay .overlay-progress {
        margin-top: 12px; font-size: 12px; color: #6c7086; text-align: center;
      }
    `;
    document.head.appendChild(style);

    const pasteArea = document.getElementById('overlay-paste-area');
    const pasteText = document.getElementById('overlay-paste-text');
    const pastePreview = document.getElementById('overlay-paste-preview');

    function updateOverlay() {
      if (currentIndex >= localImages.length) {
        removeOverlay();
        alert(t('overlayDone'));
        return;
      }

      const img = localImages[currentIndex];
      const info = document.getElementById('overlay-info');
      const progress = document.getElementById('overlay-progress');
      info.innerHTML = `
        <div><strong>${t('overlayAlt')}:</strong> ${img.alt || t('overlayNone')}</div>
        <div><strong>${t('overlayPath')}:</strong> <span class="img-path">${img.src}</span></div>
      `;
      progress.textContent = `${currentIndex + 1} / ${localImages.length}`;

      // Reset paste area
      pasteArea.classList.remove('has-image');
      pasteText.textContent = t('replaceImagesHint');
      pasteText.style.display = '';
      pastePreview.style.display = 'none';
      pasteArea.focus();
    }

    function removeOverlay() {
      const el = document.getElementById('image-replace-overlay');
      const st = document.getElementById('image-replace-overlay-style');
      if (el) el.remove();
      if (st) st.remove();
      // Restore normal paste handler on editor
      editor.removeEventListener('paste', overlayPasteHandler);
      editor.addEventListener('paste', handlePasteImage);
    }

    function handlePastedImage(blob) {
      blobToDataUrl(blob).then(dataUrl => {
        // Show preview in overlay
        pastePreview.src = dataUrl;
        pastePreview.style.display = '';
        pasteText.style.display = 'none';
        pasteArea.classList.add('has-image');

        embeddedImageCounter++;
        const placeholder = `![pasted-image-${embeddedImageCounter}]`;
        embeddedImages.set(placeholder, dataUrl);

        // Replace the local image reference in the editor
        const currentText = editor.value;
        editor.value = currentText.replace(localImages[currentIndex].fullMatch, placeholder);
        updatePreview();
        debouncedSave();

        // Auto-advance after a short delay
        setTimeout(() => {
          currentIndex++;
          updateOverlay();
        }, 600);
      }).catch(err => {
        console.warn('Failed to embed replacement image:', err);
        currentIndex++;
        updateOverlay();
      });
    }

    function overlayPasteHandler(e) {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) handlePastedImage(blob);
          return;
        }
      }
    }

    // Also handle paste on the paste area directly
    pasteArea.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const blob = item.getAsFile();
          if (blob) handlePastedImage(blob);
          return;
        }
      }
    });

    // Also handle paste on the whole overlay
    overlay.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const blob = item.getAsFile();
          if (blob) handlePastedImage(blob);
          return;
        }
      }
    });

    // Skip button
    document.getElementById('overlay-skip').addEventListener('click', () => {
      currentIndex++;
      updateOverlay();
    });

    // Cancel button
    document.getElementById('overlay-cancel').addEventListener('click', () => {
      removeOverlay();
    });

    // Set up paste handler on editor
    editor.removeEventListener('paste', handlePasteImage);
    editor.addEventListener('paste', overlayPasteHandler);

    // Show first image
    updateOverlay();
  }

  function saveMarkdown() {
    let content = editor.value;
    if (!content.trim()) return;

    trackEvent('mdSave');

    // Replace embedded image placeholders with full markdown image syntax for self-contained output
    for (const [placeholder, dataUrl] of embeddedImages) {
      content = content.split(placeholder).join(`${placeholder}(${dataUrl})`);
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Theme
  // ============================================================

  function applyTheme(theme) {
    currentTheme = theme;
    const previewPanel = panelPreview;

    // Remove all theme classes
    previewPanel.classList.remove('theme-default', 'theme-academic', 'theme-minimal', 'theme-elegant');

    // Add new theme class
    if (theme !== 'default') {
      previewPanel.classList.add(`theme-${theme}`);
    }

    // Persist
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* ignore */ }
  }

  // ============================================================
  // Panel Resize
  // ============================================================

  function initResize() {
    let startX, startWidthEditor, startWidthPreview;

    function onMouseDown(e) {
      isResizing = true;
      startX = e.clientX;
      startWidthEditor = panelEditor.offsetWidth;
      startWidthPreview = panelPreview.offsetWidth;
      resizeHandle.classList.add('active');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const totalWidth = startWidthEditor + startWidthPreview;
      let newEditorWidth = startWidthEditor + dx;
      let newPreviewWidth = startWidthPreview - dx;

      // Enforce minimum widths
      const minW = 280;
      if (newEditorWidth < minW) {
        newEditorWidth = minW;
        newPreviewWidth = totalWidth - minW;
      }
      if (newPreviewWidth < minW) {
        newPreviewWidth = minW;
        newEditorWidth = totalWidth - minW;
      }

      panelEditor.style.flex = `0 0 ${newEditorWidth}px`;
      panelPreview.style.flex = `0 0 ${newPreviewWidth}px`;
    }

    function onMouseUp() {
      isResizing = false;
      resizeHandle.classList.remove('active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    resizeHandle.addEventListener('mousedown', onMouseDown);
  }

  // ============================================================
  // Persistence
  // ============================================================

  function loadSaved() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const savedTheme = localStorage.getItem(THEME_KEY);
      const savedPaper = localStorage.getItem(PAPER_KEY);
      const savedMargin = localStorage.getItem(MARGIN_KEY);

      if (saved !== null) {
        editor.value = saved;
      } else {
        editor.value = SAMPLE_MD;
      }

      if (savedTheme) {
        selTheme.value = savedTheme;
        applyTheme(savedTheme);
      }

      if (savedPaper) {
        selPaper.value = savedPaper;
        currentPaper = savedPaper;
      }

      if (savedMargin) {
        selMargin.value = savedMargin;
        currentMargin = savedMargin;
      }
    } catch (e) {
      editor.value = SAMPLE_MD;
    }
  }

  // ============================================================
  // Keyboard Shortcuts
  // ============================================================

  function initShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + P: Export PDF
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        exportPDF();
      }
      // Ctrl/Cmd + O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFile();
      }
      // Ctrl/Cmd + S: Save .md
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveMarkdown();
      }
    });

    // Tab key in editor: insert spaces
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 4;
        debouncedRender();
        debouncedSave();
      }
    });
  }

  // ============================================================
  // Sync Scroll (editor <-> preview)
  // ============================================================

  function initSyncScroll() {
    let syncing = false;

    editor.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { syncing = false; });
    });
  }

  // ============================================================
  // Paste & Drop Images (auto-embed as base64)
  // ============================================================

  /**
   * Convert a File/Blob to a base64 data URL string.
   */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Insert text at the editor's cursor position.
   */
  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.focus();
    debouncedRender();
    debouncedSave();
  }

  /**
   * Handle paste events — detect images and embed as base64 Markdown.
   * Stores the full data URL in the embeddedImages Map and inserts a short placeholder.
   */
  async function handlePasteImage(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        try {
          const dataUrl = await blobToDataUrl(blob);
          embeddedImageCounter++;
          const placeholder = `![pasted-image-${embeddedImageCounter}]`;
          embeddedImages.set(placeholder, dataUrl);
          insertAtCursor(placeholder + '\n');
          trackEvent('imagePaste');
        } catch (err) {
          console.warn('Failed to embed pasted image:', err);
        }
        return; // Only handle the first image
      }
    }
  }

  /**
   * Handle drag-and-drop of image files onto the editor.
   * Stores the full data URL in the embeddedImages Map and inserts a short placeholder.
   */
  async function handleDropImage(e) {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    for (const file of imageFiles) {
      try {
        const dataUrl = await blobToDataUrl(file);
        embeddedImageCounter++;
        const placeholder = `![pasted-image-${embeddedImageCounter}]`;
        embeddedImages.set(placeholder, dataUrl);
        insertAtCursor(placeholder + '\n');
        trackEvent('imagePaste');
      } catch (err) {
        console.warn('Failed to embed dropped image:', file.name, err);
      }
    }
  }

  function initPasteImage() {
    editor.addEventListener('paste', handlePasteImage);
    editor.addEventListener('drop', handleDropImage);
    // Prevent default dragover behavior to allow drop
    editor.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // ============================================================
  // Insert Image (toolbar button)
  // ============================================================

  /**
   * Trigger the hidden file input to let user select an image.
   * The image will be inserted at the current cursor position in the editor.
   */
  function insertImageFromButton() {
    imageInput.click();
  }

  /**
   * Handle the selected image file: read as base64, store in map, insert placeholder.
   */
  async function handleImageInsert(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const dataUrl = await blobToDataUrl(file);
      embeddedImageCounter++;
      const placeholder = `![${file.name}]`;
      // Use a unique key that includes the filename for better readability
      const mapKey = `![pasted-image-${embeddedImageCounter}]`;
      embeddedImages.set(mapKey, dataUrl);

      // Insert at cursor position
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const before = editor.value.substring(0, start);
      const after = editor.value.substring(end);
      // Use the readable placeholder in the editor
      editor.value = before + mapKey + after;
      editor.selectionStart = editor.selectionEnd = start + mapKey.length;
      editor.focus();

      updatePreview();
      debouncedSave();
      trackEvent('imagePaste');
    } catch (err) {
      console.warn('Failed to insert image:', err);
    }

    // Reset input so same file can be selected again
    imageInput.value = '';
  }

  // ============================================================
  // Feedback Modal
  // ============================================================

  const FEEDBACK_EMAIL = 'o.mallowan@outlook.com';

  function showFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (!modal) return;
    modal.style.display = '';
    // Auto-copy email
    copyEmailToClipboard();
  }

  function hideFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    if (modal) modal.style.display = 'none';
    const copied = document.getElementById('feedback-modal-copied');
    if (copied) copied.style.display = 'none';
  }

  function copyEmailToClipboard() {
    const copied = document.getElementById('feedback-modal-copied');
    navigator.clipboard.writeText(FEEDBACK_EMAIL).then(() => {
      if (copied) copied.style.display = '';
      setTimeout(() => { if (copied) copied.style.display = 'none'; }, 3000);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = FEEDBACK_EMAIL;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try { document.execCommand('copy'); if (copied) copied.style.display = ''; } catch (e) { /* ignore */ }
      document.body.removeChild(textarea);
      setTimeout(() => { if (copied) copied.style.display = 'none'; }, 3000);
    });
  }

  function initFeedbackModal() {
    const btn = document.getElementById('btn-feedback');
    const closeBtn = document.getElementById('feedback-modal-close');
    const backdrop = document.getElementById('feedback-modal-backdrop');
    const copyBtn = document.getElementById('feedback-modal-copy-btn');

    if (btn) btn.addEventListener('click', showFeedbackModal);
    if (closeBtn) closeBtn.addEventListener('click', hideFeedbackModal);
    if (backdrop) backdrop.addEventListener('click', hideFeedbackModal);
    if (copyBtn) copyBtn.addEventListener('click', copyEmailToClipboard);
  }

  // ============================================================
  // Download Skill (generates .skill zip from embedded SKILL.md)
  // ============================================================

  /**
   * Generate a minimal .skill file (zip archive containing SKILL.md).
   * Uses a pure-JS zip implementation to avoid external dependencies.
   */
  function downloadSkill() {
    // The skill content is embedded at build time.
    // We create a simple zip file containing SKILL.md.
    const skillMd = SKILL_MD_CONTENT;
    const filename = 'md-math-to-pdf.skill';

    // Create a minimal ZIP file (stored, no compression)
    const zip = createMinimalZip([{ name: 'SKILL.md', data: skillMd }]);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Create a minimal ZIP file (store method, no compression).
   * Returns a Uint8Array.
   */
  function createMinimalZip(entries) {
    const encoder = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes = encoder.encode(entry.data);
      const crc = crc32(dataBytes);

      // Local file header
      const localHeader = new ArrayBuffer(30 + nameBytes.length);
      const lv = new DataView(localHeader);
      lv.setUint32(0, 0x04034b50, true);  // signature
      lv.setUint16(4, 20, true);           // version needed
      lv.setUint16(6, 0, true);            // flags
      lv.setUint16(8, 0, true);            // compression (stored)
      lv.setUint16(10, 0, true);           // mod time
      lv.setUint16(12, 0, true);           // mod date
      lv.setUint32(14, crc, true);         // crc32
      lv.setUint32(18, dataBytes.length, true); // compressed size
      lv.setUint32(22, dataBytes.length, true); // uncompressed size
      lv.setUint16(26, nameBytes.length, true); // name length
      lv.setUint16(28, 0, true);           // extra length
      new Uint8Array(localHeader).set(nameBytes, 30);

      parts.push(new Uint8Array(localHeader));
      parts.push(dataBytes);

      // Central directory entry
      const cdEntry = new ArrayBuffer(46 + nameBytes.length);
      const cv = new DataView(cdEntry);
      cv.setUint32(0, 0x02014b50, true);  // signature
      cv.setUint16(4, 20, true);           // version made by
      cv.setUint16(6, 20, true);           // version needed
      cv.setUint16(8, 0, true);            // flags
      cv.setUint16(10, 0, true);           // compression
      cv.setUint16(12, 0, true);           // mod time
      cv.setUint16(14, 0, true);           // mod date
      cv.setUint32(16, crc, true);         // crc32
      cv.setUint32(20, dataBytes.length, true); // compressed size
      cv.setUint32(24, dataBytes.length, true); // uncompressed size
      cv.setUint16(28, nameBytes.length, true); // name length
      cv.setUint16(30, 0, true);           // extra length
      cv.setUint16(32, 0, true);           // comment length
      cv.setUint16(34, 0, true);           // disk number
      cv.setUint16(36, 0, true);           // internal attrs
      cv.setUint32(38, 0, true);           // external attrs
      cv.setUint32(42, offset, true);      // local header offset
      new Uint8Array(cdEntry).set(nameBytes, 46);
      centralDir.push(new Uint8Array(cdEntry));

      offset += 30 + nameBytes.length + dataBytes.length;
    }

    // End of central directory
    const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
    const eocd = new ArrayBuffer(22);
    const ev = new DataView(eocd);
    ev.setUint32(0, 0x06054b50, true);     // signature
    ev.setUint16(4, 0, true);              // disk number
    ev.setUint16(6, 0, true);              // disk with cd
    ev.setUint16(8, entries.length, true);  // entries on disk
    ev.setUint16(10, entries.length, true); // total entries
    ev.setUint32(12, cdSize, true);         // cd size
    ev.setUint32(16, offset, true);         // cd offset
    ev.setUint16(20, 0, true);             // comment length

    // Combine all parts
    const totalSize = offset + cdSize + 22;
    const result = new Uint8Array(totalSize);
    let pos = 0;
    for (const part of parts) { result.set(part, pos); pos += part.length; }
    for (const cd of centralDir) { result.set(cd, pos); pos += cd.length; }
    result.set(new Uint8Array(eocd), pos);

    return result;
  }

  /**
   * CRC32 calculation for ZIP.
   */
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) & 0xFFFFFFFF;
  }

  function initDownloadSkill() {
    const btn = document.getElementById('btn-download-skill');
    if (btn) btn.addEventListener('click', downloadSkill);
  }

  // ============================================================
  // Analytics (hidden, admin-only dashboard via #admin-panel)
  // ============================================================

  const ANALYTICS_KEY = 'md2pdf-analytics';

  /**
   * Analytics data structure stored in localStorage:
   * {
   *   visits: { "2026-06-28": 3, "2026-06-27": 1, ... },
   *   events: {
   *     pdfExport: 12,
   *     htmlExport: 5,
   *     browserOpen: 8,
   *     fileOpen: 20,
   *     mdSave: 15,
   *     imagePaste: 7
   *   }
   * }
   */

  function getAnalytics() {
    try {
      const data = localStorage.getItem(ANALYTICS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) { /* ignore */ }
    return { visits: {}, events: {} };
  }

  function saveAnalytics(data) {
    try {
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function trackVisit() {
    const data = getAnalytics();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    data.visits = data.visits || {};
    data.visits[today] = (data.visits[today] || 0) + 1;
    saveAnalytics(data);
  }

  function trackEvent(eventName) {
    const data = getAnalytics();
    data.events = data.events || {};
    data.events[eventName] = (data.events[eventName] || 0) + 1;
    saveAnalytics(data);
  }

  // Admin Dashboard
  function showAdminDashboard() {
    const dashboard = document.getElementById('admin-dashboard');
    if (!dashboard) return;
    dashboard.style.display = '';
    renderAdminDashboard();
  }

  function hideAdminDashboard() {
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard) dashboard.style.display = 'none';
    // Clear the hash without scrolling
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function renderAdminDashboard() {
    const data = getAnalytics();
    const visits = data.visits || {};
    const events = data.events || {};

    // Total visits
    const totalVisits = Object.values(visits).reduce((s, v) => s + v, 0);
    document.getElementById('admin-visits').textContent = totalVisits;

    // Today visits
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('admin-today-visits').textContent = visits[today] || 0;

    // Event counts
    document.getElementById('admin-pdf-exports').textContent = events.pdfExport || 0;
    document.getElementById('admin-html-exports').textContent = events.htmlExport || 0;
    document.getElementById('admin-browser-opens').textContent = events.browserOpen || 0;
    document.getElementById('admin-file-opens').textContent = events.fileOpen || 0;
    document.getElementById('admin-md-saves').textContent = events.mdSave || 0;
    document.getElementById('admin-images-pasted').textContent = events.imagePaste || 0;

    // Visit log (last 30 days)
    const visitLogEl = document.getElementById('admin-visit-log');
    visitLogEl.innerHTML = '';
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = visits[dateStr] || 0;
      const dayEl = document.createElement('div');
      dayEl.className = 'admin-visit-day' + (count > 0 ? ' has-visits' : '');
      dayEl.innerHTML = `<span class="day-count">${count}</span><span class="day-label">${dateStr.slice(5)}</span>`;
      visitLogEl.appendChild(dayEl);
    }

    // Usage breakdown (bar chart)
    const breakdownEl = document.getElementById('admin-usage-breakdown');
    breakdownEl.innerHTML = '';
    const eventLabels = {
      pdfExport: 'PDF Export',
      htmlExport: 'HTML Export',
      browserOpen: 'Browser Open',
      fileOpen: 'File Open',
      mdSave: 'MD Save',
      imagePaste: 'Image Paste'
    };
    const maxCount = Math.max(1, ...Object.values(events));
    for (const [key, label] of Object.entries(eventLabels)) {
      const count = events[key] || 0;
      const pct = (count / maxCount) * 100;
      const row = document.createElement('div');
      row.className = 'admin-usage-row';
      row.innerHTML = `
        <span class="admin-usage-label">${label}</span>
        <div class="admin-usage-bar-bg"><div class="admin-usage-bar" style="width:${pct}%"></div></div>
        <span class="admin-usage-count">${count}</span>
      `;
      breakdownEl.appendChild(row);
    }
  }

  function initAdminDashboard() {
    // Check hash on load
    if (window.location.hash === '#admin-panel') {
      showAdminDashboard();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin-panel') {
        showAdminDashboard();
      } else {
        hideAdminDashboard();
      }
    });

    // Close button
    const closeBtn = document.getElementById('admin-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideAdminDashboard);
    }

    // Export data button
    const exportBtn = document.getElementById('admin-export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const data = getAnalytics();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mathpdf-analytics-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Reset data button
    const resetBtn = document.getElementById('admin-reset-data');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all analytics data? This cannot be undone.')) {
          localStorage.removeItem(ANALYTICS_KEY);
          renderAdminDashboard();
        }
      });
    }
  }

  // ============================================================
  // Initialization
  // ============================================================

  function init() {
    // Track visit
    trackVisit();

    // Init parser
    initParser();

    // Set language
    currentLang = detectLanguage();

    // Load saved content
    loadSaved();

    // Apply language to UI
    applyLanguage();

    // Initial render
    updatePreview();

    // Event listeners
    editor.addEventListener('input', () => {
      debouncedRender();
      debouncedSave();
    });

    $('#btn-open').addEventListener('click', openFile);
    $('#btn-save-md').addEventListener('click', saveMarkdown);
    $('#btn-export').addEventListener('click', exportPDF);
    $('#btn-export-html').addEventListener('click', exportHTML);
    $('#btn-open-browser').addEventListener('click', openInBrowser);
    $('#btn-insert-image').addEventListener('click', insertImageFromButton);
    imageInput.addEventListener('change', handleImageInsert);
    fileInput.addEventListener('change', handleFileOpen);
    imageFolderInput.addEventListener('change', handleImageFolderSelect);

    selTheme.addEventListener('change', () => applyTheme(selTheme.value));

    selLang.addEventListener('change', () => {
      currentLang = selLang.value;
      try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) { /* ignore */ }
      applyLanguage();
    });

    selPaper.addEventListener('change', () => {
      currentPaper = selPaper.value;
      try { localStorage.setItem(PAPER_KEY, currentPaper); } catch (e) { /* ignore */ }
    });

    selMargin.addEventListener('change', () => {
      currentMargin = selMargin.value;
      try { localStorage.setItem(MARGIN_KEY, currentMargin); } catch (e) { /* ignore */ }
    });

    // Panel resize
    initResize();

    // Sync scroll
    initSyncScroll();

    // Paste & drop images
    initPasteImage();

    // Feedback modal
    initFeedbackModal();

    // Download skill
    initDownloadSkill();

    // Keyboard shortcuts
    initShortcuts();

    // Admin analytics dashboard
    initAdminDashboard();
  }

  // Wait for DOM and dependencies
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
