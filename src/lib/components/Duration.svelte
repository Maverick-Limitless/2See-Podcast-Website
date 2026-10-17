<script lang="ts">
  interface Props {
    seconds: number | null;
  }

  const { seconds }: Props = $props();

  let formatted = $derived.by(() => {
    if (seconds === null || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
    if (hours > 0) return `${hours}:${mm}:${String(rest).padStart(2, '0')}`;
    return `${mm}:${String(rest).padStart(2, '0')}`;
  });
</script>

<time datetime={`PT${seconds}S`}>{formatted}</time>
