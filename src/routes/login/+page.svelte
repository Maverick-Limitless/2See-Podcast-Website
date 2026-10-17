<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>Publisher sign in — 2See Podcast</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="login">
  <div class="login__card">
    <p class="wordmark" style="margin-bottom: 1.5rem">
      <span class="wordmark__numeral">2</span>
      <span class="wordmark__text">Publisher</span>
    </p>

    <h1 class="login__title">Sign in</h1>
    <p class="login__sub">
      The publishing panel has exactly one account. No registration is available.
    </p>

    {#if form?.error}
      <p class="notice notice--error" role="alert">{form.error}</p>
    {/if}

    <form class="form" method="POST" action="?/login">
      <input type="hidden" name="csrf" value={data.csrfToken} />
      <input type="hidden" name="next" value={data.next} />

      <div class="field">
        <label class="field__label" for="username">Username</label>
        <input
          class="input"
          id="username"
          name="username"
          type="text"
          autocomplete="username"
          required
          value={data.username}
          aria-describedby="username-hint"
        />
        <p class="field__hint" id="username-hint">Fixed for this installation.</p>
      </div>

      <div class="field">
        <label class="field__label" for="password">Password</label>
        <input
          class="input"
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          minlength="12"
        />
      </div>

      <button class="btn btn--primary btn--block" type="submit">Sign in</button>
    </form>

    <p class="field__hint" style="margin-top: 1.25rem">
      Sessions expire automatically. Signing out invalidates the cookie on the server.
    </p>
  </div>
</div>
