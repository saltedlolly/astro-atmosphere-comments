// Bluesky post text with its links, @mentions and #tags ("facets") turned into
// segments, ready to show as text and links.
export type Segment = { text: string; href: string | null };

export type Facet = {
  index?: { byteStart?: number; byteEnd?: number };
  features?: { $type?: string; uri?: string; did?: string; tag?: string }[];
};

function safeHttpUrl(raw: string | undefined): string | null {
  try {
    const url = new URL(raw ?? "");
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function facetHref(facet: Facet): string | null {
  for (const feature of facet.features ?? []) {
    if (feature.$type === "app.bsky.richtext.facet#link") return safeHttpUrl(feature.uri);
    if (feature.$type === "app.bsky.richtext.facet#mention" && feature.did) {
      return `https://bsky.app/profile/${encodeURIComponent(feature.did)}`;
    }
    if (feature.$type === "app.bsky.richtext.facet#tag" && feature.tag) {
      return `https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}`;
    }
  }
  return null;
}

// Facet positions are UTF-8 byte offsets, so the encoded bytes are sliced
// rather than the JavaScript string, keeping emoji and accents aligned.
export function segments(text: string, facets: Facet[] = [], maxLength = 1000): Segment[] {
  const bytes = new TextEncoder().encode(text);
  const decode = (from: number, to?: number) => new TextDecoder().decode(bytes.subarray(from, to));
  const out: Segment[] = [];
  let cursor = 0;
  const ordered = facets
    .map((facet) => ({ start: facet.index?.byteStart ?? -1, end: facet.index?.byteEnd ?? -1, href: facetHref(facet) }))
    .filter((facet) => facet.href && facet.start >= 0 && facet.end > facet.start && facet.end <= bytes.length)
    .sort((first, second) => first.start - second.start);
  for (const facet of ordered) {
    if (facet.start < cursor) continue;
    if (facet.start > cursor) out.push({ text: decode(cursor, facet.start), href: null });
    out.push({ text: decode(facet.start, facet.end), href: facet.href });
    cursor = facet.end;
  }
  if (cursor < bytes.length) out.push({ text: decode(cursor), href: null });

  // Very long replies are shortened.
  let remaining = maxLength;
  const shortened: Segment[] = [];
  for (const segment of out) {
    if (remaining <= 0) break;
    const piece = segment.text.length > remaining ? `${segment.text.slice(0, remaining - 1)}…` : segment.text;
    shortened.push({ ...segment, text: piece });
    remaining -= piece.length;
  }
  return shortened;
}
