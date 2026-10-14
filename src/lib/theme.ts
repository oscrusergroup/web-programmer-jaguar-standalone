export const THEME_STORAGE_KEY = "jaguar-reader-theme";
export type Theme = "light" | "dark";

// Runs in the document head before the page paints, including on static hosting.
export const THEME_INIT_SCRIPT = `(() => {
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
})();`;
