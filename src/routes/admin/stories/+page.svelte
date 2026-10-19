<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  const items = $derived(data.stories.items);
  const total = $derived(data.stories.total);
  const filters = $derived(data.filters);

  let confirmDelete = $state<number | null>(null);
  let bodyMarkdown = $state('');

  function showPreview(): void {
    (document.getElementById('preview-form') as HTMLFormElement | null)?.requestSubmit();
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function stateBadge(state: string): string {
    return state === 'published' ? 'badge--published' : 'badge--draft';
  }
</script>

<svelte:head>
  <title>Stories — Publisher</title>
</svelte:head>

<div class="admin__head">
  <div>
    <h1 class="admin__title">Stories</h1>
    <p class="admin__sub">Write an article, save a draft, then publish. Reading time is measured from the actual text.</p>
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
    <h2 class="panel__title">New story</h2>
  </div>
  <div class="panel__body">
    <form
      class="form form--wide"
      method="POST"
      action="?/add"
      use:enhance={() => {
        return async ({ result, update }) => {
          // Live-ish preview on success is handled by the preview panel below.
          await update({ reset: false });
        };
      }}
    >
      <input type="hidden" name="csrf" value={data.csrfToken} />

      <div class="field">
        <label class="field__label" for="title">Title</label>
        <input class="input" id="title" name="title" type="text" required />
      </div>

      <div class="field">
        <label class="field__label" for="subtitle">Subtitle</label>
        <input class="input" id="subtitle" name="subtitle" type="text" />
      </div>

      <div class="field">
        <label class="field__label" for="bodyMarkdown">Body (Markdown)</label>
        <textarea
          class="textarea textarea--rich"
          id="bodyMarkdown"
          name="bodyMarkdown"
          required
          oninput={(event) => {
            bodyMarkdown = event.currentTarget.value;
          }}
        ></textarea>
        <p class="field__hint">
          Headings, lists, quotes, links, emphasis and fenced code are supported. Raw HTML is
          escaped, never rendered — that is deliberate.
        </p>
        <button class="btn btn--quiet btn--small" type="button" onclick={showPreview}>Preview</button>
      </div>



      {#if form?.html !== undefined}
        <div class="panel">
          <div class="panel__head">
            <h3 class="panel__title">Preview</h3>
            <span class="badge">Sanitised, exactly like the public page</span>
          </div>
          <div class="panel__body">
            <div class="prose">
              {@html form.html}
            </div>
          </div>
        </div>
      {/if}

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="category">Category</label>
          <input class="input" id="category" name="category" type="text" list="story-categories" />
          <datalist id="story-categories">
            {#each data.categories as category (category)}
              <option value={category}></option>
            {/each}
          </datalist>
        </div>
        <div class="field">
          <label class="field__label" for="author">Author</label>
          <input class="input" id="author" name="author" type="text" />
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="summary">Summary</label>
        <input class="input" id="summary" name="summary" type="text" />
      </div>

      <div class="form__row">
        <div class="field">
          <label class="field__label" for="coverImage">Cover image URL</label>
          <input class="input" id="coverImage" name="coverImage" type="url" />
        </div>
        <div class="field">
          <label class="field__label" for="coverAlt">Cover alternative text</label>
          <input class="input" id="coverAlt" name="coverAlt" type="text" />
        </div>
      </div>

      <div class="form__actions">
        <button class="btn btn--ghost" type="submit" name="state" value="draft">Save draft</button>
        <button class="btn btn--primary" type="submit" name="state" value="published">Publish</button>
      </div>
    </form>
  </div>
</div>

      <form
        id="preview-form"
        class="visually-hidden"
        method="POST"
        action="?/preview"
        use:enhance={() => {
          return async ({ update }) => {
            await update({ reset: false });
          };
        }}
      >
        <input type="hidden" name="bodyMarkdown" value={bodyMarkdown} />
      </form>

<div class="panel">
  <div class="panel__head">
    <h2 class="panel__title">All stories ({total})</h2>
    <form class="toolbar" method="get" style="border: 0; padding: 0; gap: 0.5rem">
      <input
        class="input"
        type="search"
        name="q"
        value={filters.query}
        placeholder="Search"
        aria-label="Search stories"
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
      <p class="field__hint" style="margin: 0">No stories yet.</p>
    </div>
  {:else}
    <table class="table table--stack">
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Read</th>
          <th><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each items as story (story.id)}
          <tr>
            <td data-label="Title">
              <a class="table__title" href={`/stories/${story.slug}`}>{story.title}</a>
              <span class="table__meta">{formatDate(story.publishedAt)}</span>
            </td>
            <td data-label="Status">
              <span class="badge {stateBadge(story.state)}">{story.state}</span>
            </td>
            <td data-label="Read">{story.readingMinutes} min</td>
            <td data-label="">
              <div class="table__actions">
                {#if story.state === 'draft'}
                  <form method="POST" action="?/publish" use:enhance>
                    <input type="hidden" name="csrf" value={data.csrfToken} />
                    <input type="hidden" name="id" value={story.id} />
                    <button class="btn btn--small btn--primary" type="submit">Publish</button>
                  </form>
                {:else}
                  <form method="POST" action="?/unpublish" use:enhance>
                    <input type="hidden" name="csrf" value={data.csrfToken} />
                    <input type="hidden" name="id" value={story.id} />
                    <button class="btn btn--small btn--ghost" type="submit">Unpublish</button>
                  </form>
                {/if}

                <form method="POST" action="?/remove" use:enhance>
                  <input type="hidden" name="csrf" value={data.csrfToken} />
                  <input type="hidden" name="id" value={story.id} />
                  <input type="hidden" name="confirm" value={confirmDelete === story.id ? 'yes' : ''} />
                  {#if confirmDelete === story.id}
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
                      onclick={() => (confirmDelete = story.id)}
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
