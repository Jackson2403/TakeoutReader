/// <reference types="vite/client" />

// WebKit-only folder-picker attribute on <input type="file">.
declare namespace React {
  interface InputHTMLAttributes<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitdirectory?: string | boolean;
  }
}