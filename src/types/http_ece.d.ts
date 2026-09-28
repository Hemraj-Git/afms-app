// http_ece ships no types; only the tests use it (to check Web Push encryption).
declare module 'http_ece' {
  import type { ECDH } from 'node:crypto'
  interface DecryptParams {
    version: 'aes128gcm' | 'aesgcm'
    privateKey?: ECDH
    authSecret?: string | Buffer
    dh?: string | Buffer
  }
  const ece: { decrypt(buffer: Buffer, params: DecryptParams): Buffer }
  export default ece
}
