// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Authenticated administrator, when a valid server-side session was presented. */
      admin: { id: number; username: string; displayName: string } | null;
      /** CSRF token for this visitor, always present, never a secret on its own. */
      csrfToken: string;
      /** Best-effort client address for rate limiting. Never trusted for identity. */
      clientAddress: string;
    }
    interface PageData {
      site: import('$lib/shared/types').SiteSettings;
      navigationYear: number;
    }
    interface Error {
      message: string;
      code?: number;
    }
    interface Platform {}
  }
}

export {};
