/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_PORT?: string
  readonly WEB_PORT?: string
  readonly RGB_NODE_HOST?: string
  readonly RGB_NODE_PORT?: string
  readonly RGB_PEER_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
