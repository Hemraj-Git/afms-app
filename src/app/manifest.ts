import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AFMS - Asset & Facility Management System',
    short_name: 'AFMS Field',
    description: 'Maritime Institute Asset & Facility Management System',
    start_url: '/mobile',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/next.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/next.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}
