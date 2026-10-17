<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const items = $derived(data.episodes.items);
  const total = $derived(data.episodes.total);
  const filters = $derived(data.filters);

  let confirmDelete = $state<number | null>(null);

  function stateBadge(state: string): string {
    return state === 'published' ? 'badge--published' : 'badge--draft';
  }

  function formatDate(iso: string): string {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function duration(seconds: number | null): string {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>Episodes — Publisher</title>
</svelte:head>

<div class="admin__head">
  <div>
    <h1 class="admin__title">Episodes</h1>
    <p class="admin__sub">
      Add videos by hand, or pull them from YouTube. Everything lands as a draft until you publish it.
    </p>
  </div>
  <form method="POST" action="?/sync" use:enhance>
    <input type="hidden" name="csrf" value={data.csrfToken} />
    <button class="btn btn--ghost btn--small" type="submit" disabled={!data.youtubeConfigured}>
      Synchronise now
    </button>
  </form>
</div>

{#if form?.error}
  <div class="notice notice--error" role="alert" style="margin-bottom: 1rem">{form.error}</div>
{/if}
{#if form?.message}
  <div class="notice notice--ok" role="status" style="margin-bottom: 1rem">{form.message}</div>
{/if}

<!-- Method A: add a YouTube video by hand. -->
<div class="panel" style="margin-bottom: 1.5rem">
  <div class="panel__head">
    <h2 class="panel__title">Add a YouTube video</h2>
    <span class="badge">Manual</span>
  </div>
  <div class="panel__body">
    <form class="form form--wide" method="POST" action="?/add" use:enhance>
      <input type="hidden" name="csrf" value={data.csrfToken} />

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="youtubeUrl">YouTube URL</label>
          <input
            class="input"
            id="youtubeUrl"
            name="youtubeUrl"
            type="url"
            required
            placeholder="https://www.youtube.com/watch?v=…"
          />
          <p class="field__hint">Watch, share (youtu.be) and /shorts/ links are accepted.</p>
        </div>
        <div class="field">
          <label class="field__label" for="thumbnail">Thumbnail URL</label>
          <input
            class="input"
            id="thumbnail"
            name="thumbnail"
            type="url"
            placeholder="https://i.ytimg.com/vi/…/maxresdefault.jpg"
          />
        </div>
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="title">Title</label>
          <input class="input" id="title" name="title" type="text" required />
        </div>
        <div class="field">
          <label class="field__label" for="originalTitle">Original title (if it differs)</label>
          <input class="input" id="originalTitle" name="originalTitle" type="text" />
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="description">Description</label>
        <textarea class="textarea" id="description" name="description"></textarea>
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="summary">Summary</label>
          <input class="input" id="summary" name="summary" type="text" />
        </div>
        <div class="field">
          <label class="field__label" for="guests">Guests</label>
          <input
            class="input"
            id="guests"
            name="guests"
            type="text"
            placeholder="Comma separated"
          />
        </div>
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="category">Category</label>
          <input class="input" id="category" name="category" type="text" list="episode-categories" />
          <datalist id="episode-categories">
            {#each data.categories as category (category)}
              <option value={category}></option>
            {/each}
          </datalist>
        </div>
        <div class="field">
          <label class="field__label" for="tags">Tags</label>
          <input class="input" id="tags" name="tags" type="text" placeholder="Comma separated" />
        </div>
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="publishedAt">Publication date</label>
          <input class="input" id="publishedAt" name="publishedAt" type="datetime-local" required />
        </div>
        <div class="field">
          <label class="field__label" for="durationSeconds">Duration in seconds</label>
          <input class="input" id="durationSeconds" name="durationSeconds" type="number" min="1" />
        </div>
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="language">Language</label>
          <select class="select" id="language" name="language">
            <option value="fa">Persian</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="format">Format</label>
          <select class="select" id="format" name="format">
            <option value="episode">Long-form conversation</option>
            <option value="brief">Weekly brief</option>
            <option value="short">Short</option>
          </select>
        </div>
      </div>

      <div class="form__actions">
        <button class="btn btn--primary" type="submit">Add as draft</button>
        <span class="field__hint">
          Duplicate videos are rejected by video ID, so a re-add cannot create a second entry.
        </span>
      </div>
    </form>
  </div>
</div>

<!-- Archive list. -->
<div class="panel">
  <div class="panel__head">
    <h2 class="panel__title">Archive ({total})</h2>
    <form class="toolbar" method="get" style="border: 0; padding: 0; gap: 0.5rem">
      <input
        class="input"
        type="search"
        name="q"
        value={filters.query}
        placeholder="Search"
        aria-label="Search episodes"
      />
      <select class="select" name="state" aria-label="Status">
        <option value="all" selected={filters.state === 'all'}>All</option>
        <option value="draft" selected={filters.state === 'draft'}>Drafts</option>
        <option value="published" selected={filters.state === 'published'}>Published</option>
      </select>
      <button class="btn btn--ghost btn--small" type="submit">Filter</button>
    </form>
  </div>

  {#if items.length === 0}
    <div class="panel__body">
      <p class="field__hint" style="margin: 0">
        No episodes yet. Add one above, or run a synchronisation.
      </p>
    </div>
  {:else}
    <table class="table table--stack">
      <thead>
        <tr>
          <th>Episode</th>
          <th>Status</th>
          <th>Published</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each items as item (item.id)}
          <tr>
            <td data-label="Episode">
              <span class="table__title">{item.originalTitle || item.title}</span>
              <span class="table__meta">{item.youtubeId}</span>
            </td>
            <td data-label="Status">
              <span class="badge {stateBadge(item.state)}">{item.state}</span>
            </td>
            <td data-label="Published">{formatDate(item.publishedAt)}</td>
            <td data-label="">
              <div class="table__actions">
                {#if item.state === 'draft'}
                  <form method="POST" action="?/publish" use:enhance>
                    <input type="hidden" name="csrf" value={data.csrfToken} />
                    <input type="hidden" name="id" value={item.id} />
                    <button class="btn btn--small btn--primary" type="submit">Publish</button>
                  </form>
                {:else}
                  <form method="POST" action="?/unpublish" use:enhance>
                    <input type="hidden" name="csrf" value={data.csrfToken} />
                    <input type="hidden" name="id" value={item.id} />
                    <button class="btn btn--small btn--ghost" type="submit">Unpublish</button>
                  </form>
                {/if}

                <form method="POST" action="?/remove" use:enhance>
                  <input type="hidden" name="csrf" value={data.csrfToken} />
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="confirm" value={confirmDelete === item.id ? 'yes' : ''} />
                  {#if confirmDelete === item.id}
                    <button class="btn btn--small btn--danger" type="submit">Confirm delete</button>
                    <button
                      class="btn btn--small btn--quiet"
                      type="button"
                      onclick={() => (confirmDelete = null)}
                    >Cancel</button>
                  {:else}
                    <button
                      class="btn btn--small btn--quiet"
                      type="button"
                      onclick={() => (confirmDelete = item.id)}
                    >Delete</button>
                  {/if}
                </form>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
