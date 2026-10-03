import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AssetNXG',
    short_name: 'AssetNXG',
    description: 'Asset & facility management',
    start_url: '/mobile',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    // PNG icons (built from the AssetNXG hexagon by scripts/make-icons.mjs): installing
    // the app, and push alerts on iPhone, need real PNGs.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
