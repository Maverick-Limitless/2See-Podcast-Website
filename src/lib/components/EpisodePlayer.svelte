<script lang="ts">
  interface Props {
    videoId: string;
    thumbnail: string;
    title: string;
    watchUrl: string;
  }

  const { videoId, thumbnail, title, watchUrl }: Props = $props();

  /**
   * Thumbnail-first player. The iframe is only inserted after a deliberate
   * click, so no YouTube resources are requested until the visitor asks for
   * them. If the embed cannot load, the official link remains — the page is
   * never left as an empty rectangle.
   */
  let mode = $state<'poster' | 'playing' | 'failed'>('poster');

  function start(): void {
    mode = 'playing';
  }

  function onFrameError(): void {
    mode = 'failed';
  }
</script>

<div class="player-shell">
  {#if mode === 'poster'}
    <button class="player-slate" type="button" onclick={start} aria-label="Play episode on YouTube">
      {#if thumbnail}
        <img class="player-slate__image" src={thumbnail} alt="" width="1280" height="720" />
      {/if}
      <span class="player-slate__scrim"></span>
      <span class="player-slate__play">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span class="player-slate__label">Watch on YouTube</span>
    </button>
  {:else if mode === 'playing'}
    <div class="player-frame">
      <!--
        youtube-nocookie is the privacy-enhanced host. The parameters disable
        autoplay with sound and are the only ones needed for a clean embed.
      -->
      <iframe
        title={`${title} — YouTube player`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        loading="lazy"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        onerror={onFrameError}
      ></iframe>
    </div>
  {:else}
    <div class="error-state" role="status">
      <p style="margin: 0 0 0.5rem">
        The embedded player could not be loaded. This is expected when YouTube is unreachable from
        your network.
      </p>
      <p style="margin: 0">
        <a class="section__link" href={watchUrl} rel="noopener noreferrer" target="_blank">
          Open this episode on YouTube <span aria-hidden="true">→</span>
        </a>
      </p>
    </div>
  {/if}
</div>

<style>
  .player-shell {
    margin: 0 0 2rem;
  }
</style>
