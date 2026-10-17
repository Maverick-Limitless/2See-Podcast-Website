<script lang="ts">
  let { data } = $props();

  const syncStatus = $derived(
    data.sync.lastStatus === 'never'
      ? 'Never run'
      : data.sync.lastStatus === 'running'
        ? 'Running'
        : data.sync.lastStatus === 'ok'
          ? 'Completed'
          : data.sync.lastStatus === 'partial'
            ? 'Partial'
            : 'Failed'
  );

  const lastRun = $derived(
    data.sync.lastRunAt
      ? new Date(data.sync.lastRunAt.replace(' ', 'T') + 'Z').toLocaleString('en-GB')
      : '—'
  );
</script>

<svelte:head>
  <title>Overview — Publisher</title>
</svelte:head>

<div class="admin__head">
  <div>
    <h1 class="admin__title">Overview</h1>
    <p class="admin__sub">Signed in as the publisher.</p>
  </div>
  <form method="POST" action="/admin/episodes?/sync" use:enhance>
    <button class="btn btn--ghost btn--small" type="submit">Synchronise now</button>
  </form>
</div>

<div class="stats">
  <div class="stat">
    <span class="stat__value">{data.publishedStories}</span>
    <span class="stat__label">Published stories</span>
  </div>
  <div class="stat">
    <span class="stat__value">{data.publishedEpisodes}</span>
    <span class="stat__label">Published episodes</span>
  </div>
  <div class="stat">
    <span class="stat__value">{data.draftStories + data.draftEpisodes}</span>
    <span class="stat__label">Drafts</span>
  </div>
  <div class="stat">
    <span class="stat__value">{data.sync.lastFoundCount}</span>
    <span class="stat__label">Found on last run</span>
  </div>
</div>

<div class="panel">
  <div class="panel__head">
    <h2 class="panel__title">Last synchronisation</h2>
    <span class="badge badge--{data.sync.lastStatus === 'ok' ? 'published' : data.sync.lastStatus === 'error' ? 'draft' : ''}">
      {syncStatus}
    </span>
  </div>
  <div class="panel__body">
    <p style="margin: 0 0 0.5rem">{data.sync.lastMessage || 'No run yet.'}</p>
    <p class="table__meta" style="margin: 0">
      {lastRun} · source: {data.sync.source ?? 'none'} · {data.sync.lastCreatedCount} created,
      {data.sync.lastUpdatedCount} refreshed
    </p>
  </div>
</div>
