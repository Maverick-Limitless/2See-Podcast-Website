<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let busy = $state(false);
</script>

<svelte:head>
  <title>First-run setup — 2See Podcast</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="login">
  <div class="login__card">
    <p class="wordmark" style="margin-bottom: 1.5rem">
      <span class="wordmark__numeral">2</span>
      <span class="wordmark__text">Setup</span>
    </p>

    <h1 class="login__title">Create the administrator</h1>
    <p class="login__sub">
      This runs once. After the account exists, this page stops working.
    </p>

    {#if form?.generated}
      <div class="notice notice--warn" role="status">
        <p style="margin: 0 0 0.75rem">
          <strong>Copy this password now.</strong> It is shown only in this response and is never
          stored, logged or e-mailed. Save it in your password manager, then sign in.
        </p>
        <p
          style="margin:0; font-family: var(--font-mono); font-size: 1rem; word-break: break-all; padding: 0.75rem; background: var(--paper-soft); border-radius: 2px;"
          data-testid="generated-password"
        >
          {form.generated}
        </p>
        <p style="margin: 0.75rem 0 0">
          <a class="section__link" href="/login">Continue to sign in <span aria-hidden="true">→</span></a>
        </p>
      </div>
    {:else}
      {#if form?.error}
        <p class="notice notice--error" role="alert">{form.error}</p>
      {/if}

      {#if data.tokenConfigured}
        <form
          class="form"
          method="POST"
          action="?/default"
          use:enhance={() => {
            busy = true;
            return async ({ update }) => {
              await update({ reset: false });
              busy = false;
            };
          }}
        >
          <input type="hidden" name="csrf" value={data.csrfToken} />

          <div class="field">
            <label class="field__label" for="token">Setup token</label>
            <input class="input" id="token" name="token" type="password" required autocomplete="off" />
            <p class="field__hint">
              From the <code>ADMIN_SETUP_TOKEN</code> environment variable.
            </p>
          </div>

          <div class="field">
            <label class="field__label" for="password">Password (optional)</label>
            <input
              class="input"
              id="password"
              name="password"
              type="password"
              minlength="12"
              autocomplete="new-password"
              aria-describedby="password-hint"
            />
            <p class="field__hint" id="password-hint">
              Leave blank to have a cryptographically secure password generated for you.
            </p>
          </div>

          <button class="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create the account'}
          </button>
        </form>
      {:else}
        <div class="notice notice--warn">
          <p style="margin: 0">
            No bootstrap token is configured, so browser setup is disabled. Run
            <code>npm run init:admin</code> on the server to generate and display a secure password
            there instead.
          </p>
        </div>
      {/if}
    {/if}
  </div>
</div>
