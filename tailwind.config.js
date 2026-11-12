/** @type {import('tailwindcss').Config} */
module.exports = {
  // Escaneia templates externos (.html) e inline (.ts)
  content: ['./src/**/*.{html,ts}'],

  // Prefixo obrigatório em TODOS os utilitários (tw-flex, tw-bg-surface, ...).
  // Evita colisão de NOME com Bootstrap 4 e classes legadas — ex.: o Tailwind
  // geraria .collapse{visibility:collapse} e escondia a sidebar (.collapse do BS).
  prefix: 'tw-',

  // Dark mode dirigido pelo atributo do app: <html data-theme="dark">
  // (na prática as cores já trocam sozinhas porque os tokens são variáveis CSS)
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {
      // Cores mapeadas nos tokens do design system (src/app/ui/tokens.css).
      // Ex.: bg-surface, text-text-2, border-line, bg-a-soft, text-ok-deep
      colors: {
        bg: 'var(--bg)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: { DEFAULT: 'var(--line)', soft: 'var(--line-soft)' },
        text: { DEFAULT: 'var(--text)', 2: 'var(--text-2)', 3: 'var(--text-3)' },
        a: {
          DEFAULT: 'var(--a)', hover: 'var(--a-hover)', soft: 'var(--a-soft)',
          line: 'var(--a-line)', deep: 'var(--a-deep)',
        },
        phos: 'var(--phos)',
        ok:   { DEFAULT: 'var(--ok)',   soft: 'var(--ok-soft)',   line: 'var(--ok-line)',   deep: 'var(--ok-deep)' },
        warn: { DEFAULT: 'var(--warn)', soft: 'var(--warn-soft)', line: 'var(--warn-line)', deep: 'var(--warn-deep)' },
        err:  { DEFAULT: 'var(--err)',  soft: 'var(--err-soft)',  line: 'var(--err-line)',  deep: 'var(--err-deep)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)', line: 'var(--info-line)', deep: 'var(--info-deep)' },
        n: {
          0: 'var(--n-0)', 25: 'var(--n-25)', 50: 'var(--n-50)', 100: 'var(--n-100)',
          150: 'var(--n-150)', 200: 'var(--n-200)', 300: 'var(--n-300)', 400: 'var(--n-400)',
          500: 'var(--n-500)', 600: 'var(--n-600)', 700: 'var(--n-700)', 800: 'var(--n-800)',
          900: 'var(--n-900)', 950: 'var(--n-950)',
        },
      },

      // rounded / rounded-md / rounded-lg ... usam o raio dos tokens
      borderRadius: {
        DEFAULT: 'var(--r)',
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-lg)', xl: 'var(--r-xl)',
      },

      // font-sans / font-serif / font-mono (IBM Plex)
      fontFamily: {
        sans: ['var(--f-sans)'],
        serif: ['var(--f-serif)'],
        mono: ['var(--f-mono)'],
      },

      // shadow / shadow-sm / shadow-md ... usam a elevação quente dos tokens
      boxShadow: {
        DEFAULT: 'var(--sh)',
        xs: 'var(--sh-xs)', sm: 'var(--sh-sm)',
        md: 'var(--sh-md)', lg: 'var(--sh-lg)',
      },

      // ease-* customizados do DS
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
        ds: 'var(--ease)',
        'ds-out': 'var(--ease-out)',
      },
    },
  },

  // Preflight OFF: o Tailwind entra só como utilitários, sem reset de base.
  // Isso evita conflito com o reset do Bootstrap 4 (legado) e do styles.css.
  corePlugins: { preflight: false },

  plugins: [],
};
