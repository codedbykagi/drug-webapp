/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the sync server, e.g. http://192.168.1.20:8787. Unset = local only. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
