<script lang="ts">
</script>

<svelte:head>
  <title>Not configured — 2See Podcast</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="login">
  <div class="login__card">
    <h1 class="login__title">The publisher account is not configured</h1>
    <p class="login__sub">
      No administrator exists yet, so the publishing panel is unavailable. This is the secure
      default: a fresh installation never ships with a working account or password.
    </p>
    <div class="notice">
      <p style="margin: 0 0 0.75rem">To create the account, run on the server:</p>
      <pre
        style="margin:0; font-family: var(--font-mono); font-size: var(--t-small); white-space: pre-wrap;">npm run init:admin</pre>
      <p style="margin: 0.75rem 0 0">
        A cryptographically secure password is generated, hashed with scrypt, and shown once. It is
        never written to disk.
      </p>
    </div>
    <p style="margin-top: 1.25rem">
      <a class="section__link" href="/">Back to the website <span aria-hidden="true">→</span></a>
    </p>
  </div>
</div>
