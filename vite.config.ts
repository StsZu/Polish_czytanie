import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub repository name: the GitHub Pages build lives at https://<user>.github.io/<REPO>/. */
export const REPO = 'Polish_czytanie'

export const APP_NAME = 'Czytanie'

const ICONS = ['apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']
const DATA = 'data/cwiczenia.json'

/**
 * Emits manifest.webmanifest (start_url and scope = the base) and sw.js with the list of built files to precache.
 * Every path is relative to the base, so the same build works at / and at /<REPO>/. The recordings are not
 * precached (40 MB): the service worker caches them on demand, and its list of current recordings removes old ones.
 */
function pwa(base: string): Plugin {
  return {
    name: 'czytanie-pwa',
    apply: 'build',
    generateBundle(_, bundle) {
      const manifest = {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Тренажер читання польською: 21 вправа від звуків до тексту',
        lang: 'uk',
        ...(base === './' ? {} : { id: base }),
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f3ec',
        theme_color: '#f7f3ec',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest, null, 2) })
      const files = Object.keys(bundle).filter((name) => !name.endsWith('.map'))
      const precache = [...new Set(['./', ...files, 'manifest.webmanifest', DATA, ...ICONS])]
      const data = JSON.parse(readFileSync(new URL(`./public/${DATA}`, import.meta.url), 'utf8')) as {
        textsMd5: string
        exercises: { sections: Record<string, { audio: string | null }> }[]
      }
      const audio = data.exercises.flatMap((e) => Object.values(e.sections).map((s) => s.audio).filter(Boolean))
      const source = readFileSync(new URL('./src/pwa/sw-template.js', import.meta.url), 'utf8')
        .replace('__PRECACHE__', JSON.stringify(precache))
        .replace('__AUDIO__', JSON.stringify(audio))
        .replace('__VERSION__', `${Date.now().toString(36)}-${data.textsMd5.slice(0, 6)}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig(({ mode }) => {
  const base = mode === 'pages' ? `/${REPO}/` : './'
  return {
    base,
    plugins: [react(), pwa(base)],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    build: {
      outDir: mode === 'pages' ? 'dist-pages' : 'dist',
      target: 'safari16',
      sourcemap: false,
    },
    preview: { port: 4280, strictPort: true },
  }
})
