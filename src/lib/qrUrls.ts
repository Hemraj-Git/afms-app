// Single source of truth for the real, scannable QR URL scheme used across
// the app (QR Codes dashboard, printed labels, and the asset/room detail
// pages). Resolves through src/app/qr/page.tsx -> /mobile?type=...&id=...,
// matched by the real UUID id, not the human-readable code.
export function getRoomQrUrl(origin: string, roomId: string): string {
  const base = origin || 'http://localhost:3000'
  return `${base}/qr?type=room&id=${roomId}`
}

export function getAssetQrUrl(origin: string, assetId: string): string {
  const base = origin || 'http://localhost:3000'
  return `${base}/qr?type=asset&id=${assetId}`
}
