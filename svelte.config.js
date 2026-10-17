import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build'
    }),
    alias: {
      $lib: 'src/lib'
    },
    /**
     * Content Security Policy.
     *
     * SvelteKit injects the inline bootstrap script itself, so the policy has
     * to be generated per request with a hash for that snippet. Hand-writing a
     * `script-src 'self'` header would block hydration, which is why this is
     * declared here rather than in hooks.
     */
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': [
          'self',
          'data:',
          'https://i.ytimg.com',
          'https://i9.ytimg.com',
          'https://yt3.googleusercontent.com'
        ],
        'font-src': ['self'],
        'connect-src': ['self'],
        // The only place an iframe may come from is the official player, on the
        // privacy-enhanced host.
        'frame-src': ['https://www.youtube-nocookie.com'],
        'media-src': ['none'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none']
      }
    }
  }
};

export default config;
