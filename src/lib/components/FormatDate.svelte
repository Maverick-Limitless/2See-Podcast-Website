<script lang="ts">
  interface Props {
    iso: string | null;
    /** Include the year. Titles near a year boundary need it, lists do not. */
    withYear?: boolean;
  }

  const { iso, withYear = true }: Props = $props();

  let formatted = $derived.by(() => {
    if (!iso) return '';
    const date = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
    if (Number.isNaN(date.getTime())) return '';
    const options: Intl.DateTimeFormatOptions = withYear
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  });
</script>

{#if formatted}
  <time datetime={iso ?? ''}>{formatted}</time>
{/if}
