/// <reference types="vite/client" />
declare namespace React {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
      webkitdirectory?: string;
    }
  }