<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const hostsDraft = $derived(
    (data.site.hosts ?? [])
      .map((host) => [host.name, host.latinName, host.role, host.credentials].filter(Boolean).join(' | '))
      .join('\n')
  );
  const socialDraft = $derived(
    (data.site.socialLinks ?? []).map((link) => `${link.label} | ${link.url}`).join('\n')
  );

  const lastSync = $derived(
    data.sync.lastRunAt
      ? new Date(data.sync.lastRunAt.replace(' ', 'T') + 'Z').toLocaleString('en-GB')
      : 'never'
  );
</script>

<svelte:head>
  <title>Settings — Publisher</title>
</svelte:head>

<div class="admin__head">
  <div>
    <h1 class="admin__title">Settings</h1>
    <p class="admin__sub">Site identity, the channel it points at, and your password.</p>
  </div>
</div>

{#if form?.error}
  <div class="notice notice--error" role="alert" style="margin-bottom: 1rem">{form.error}</div>
{/if}
{#if form?.message}
  <div class="notice notice--ok" role="status" style="margin-bottom: 1rem">{form.message}</div>
{/if}

<div class="panel" style="margin-bottom: 1.5rem">
  <div class="panel__head">
    <h2 class="panel__title">Site identity</h2>
  </div>
  <div class="panel__body">
    <form class="form form--wide" method="POST" action="?/save" use:enhance>
      <input type="hidden" name="csrf" value={data.csrfToken} />

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="siteTitle">Site title</label>
          <input class="input" id="siteTitle" name="siteTitle" type="text" required value={data.site.siteTitle} />
        </div>
        <div class="field">
          <label class="field__label" for="tagline">Tagline</label>
          <input class="input" id="tagline" name="tagline" type="text" value={data.site.tagline} />
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="description">Description</label>
        <textarea class="textarea" id="description" name="description">{data.site.description}</textarea>
      </div>

      <div class="field">
        <label class="field__label" for="channelUrl">Channel URL</label>
        <input class="input" id="channelUrl" name="channelUrl" type="url" required value={data.site.channelUrl} />
        <p class="field__hint">Where the "Listen on YouTube" links point.</p>
      </div>

      <div class="field">
        <label class="field__label" for="aboutBody">About</label>
        <textarea class="textarea textarea--rich" id="aboutBody" name="aboutBody">{data.site.aboutBody}</textarea>
      </div>

      <div class="field">
        <label class="field__label" for="hosts">Hosts (Name | Latin name | Role | credentials)</label>
        <textarea class="textarea" id="hosts" name="hosts">{hostsDraft}</textarea>
        <p class="field__hint">One host per line.</p>
      </div>

      <div class="field">
        <label class="field__label" for="socialLinks">Listen links (Label | URL)</label>
        <textarea class="textarea" id="socialLinks" name="socialLinks">{socialDraft}</textarea>
      </div>

      <div class="field">
        <label class="field__label" for="footerNote">Footer note</label>
        <input class="input" id="footerNote" name="footerNote" type="text" value={data.site.footerNote} />
      </div>

      <div class="form__actions">
        <button class="btn btn--primary" type="submit">Save settings</button>
      </div>
    </form>
  </div>
</div>

<div class="panel" style="margin-bottom: 1.5rem">
  <div class="panel__head">
    <h2 class="panel__title">Synchronisation</h2>
    <span class="badge">{data.sync.lastStatus === 'ok' ? 'Working' : data.sync.lastStatus}</span>
  </div>
  <div class="panel__body">
    <p style="margin: 0 0 0.75rem">{data.sync.lastMessage || 'No run yet.'}</p>
    <div class="facts">
      <div class="facts__row">
        <dt class="facts__key">Last run</dt>
        <dd class="facts__value">{lastSync}</dd>
      </div>
      <div class="facts__row">
        <dt class="facts__key">API key</dt>
        <dd class="facts__value">
          {data.configured.youtubeApiKey ? 'Configured — full archive access' : 'Not set — public feed only'}
        </dd>
      </div>
      <div class="facts__row">
        <dt class="facts__key">Total synced</dt>
        <dd class="facts__value">{data.sync.totalSyncedCount}</dd>
      </div>
    </div>
    <p class="field__hint" style="margin-top: 0.75rem">
      Keys live in the environment file on the server and are never sent to this page.
    </p>
  </div>
</div>

<div class="panel">
  <div class="panel__head">
    <h2 class="panel__title">Password</h2>
  </div>
  <div class="panel__body">
    <form class="form" method="POST" action="?/password" use:enhance>
      <input type="hidden" name="csrf" value={data.csrfToken} />

      <div class="field">
        <label class="field__label" for="currentPassword">Current password</label>
        <input class="input" id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password" />
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="nextPassword">New password</label>
          <input class="input" id="nextPassword" name="nextPassword" type="password" required minlength="12" autocomplete="new-password" />
        </div>
        <div class="field">
          <label class="field__label" for="confirmPassword">Confirm new password</label>
          <input class="input" id="confirmPassword" name="confirmPassword" type="password" required minlength="12" autocomplete="new-password" />
        </div>
      </div>

      <div class="form__actions">
        <button class="btn btn--primary" type="submit">Change password</button>
        <span class="field__hint">Changing it signs out every session.</span>
      </div>
    </form>
  </div>
</div>
