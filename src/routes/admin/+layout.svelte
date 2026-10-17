<script lang="ts">
  import { page } from '$app/state';

  let { data, children } = $props();

  const path = $derived(page.url.pathname);
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if data.initialised}
  <div class="admin">
    <nav class="admin__nav" aria-label="Publisher sections">
      <a class="admin__brand" href="/admin">
        <span class="wordmark__numeral">2</span>
        <span>Publisher</span>
      </a>

      <ul class="admin__links">
        <li>
          <a class="admin__link" href="/admin" aria-current={path === '/admin' ? 'page' : undefined}>
            Overview
          </a>
        </li>
        <li>
          <a class="admin__link" href="/admin/stories" aria-current={path.startsWith('/admin/stories') ? 'page' : undefined}>
            Stories
          </a>
        </li>
        <li>
          <a class="admin__link" href="/admin/episodes" aria-current={path.startsWith('/admin/episodes') ? 'page' : undefined}>
            Episodes
          </a>
        </li>
        <li>
          <a class="admin__link" href="/admin/settings" aria-current={path.startsWith('/admin/settings') ? 'page' : undefined}>
            Settings
          </a>
        </li>
      </ul>

      <div style="margin-top: auto; display: grid; gap: 0.5rem">
        <a class="admin__link" href="/" target="_blank">View the site ↗</a>
        <form method="POST" action="/logout">
          <button class="admin__link" type="submit" style="color: var(--crimson)">Sign out</button>
        </form>
      </div>
    </nav>

    <div class="admin__main">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="login">
    <div class="login__card">
      <h1 class="login__title">Not configured</h1>
      <p class="login__sub">No administrator account exists yet.</p>
      <div class="notice notice--warn">
        <p style="margin: 0">
          Run <code>npm run init:admin</code> on the server to create the first account.
        </p>
      </div>
    </div>
  </div>
{/if}
