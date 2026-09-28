function blendHex(fromHex: string, toHex: string, ratio: number): string {
  const boundedRatio = Math.max(0, Math.min(1, ratio));
  const channels = [0, 2, 4].map(index => {
    const from = Number.parseInt(fromHex.replace('#', '').slice(index, index + 2), 16);
    const to = Number.parseInt(toHex.replace('#', '').slice(index, index + 2), 16);
    return Math.round(from + (to - from) * boundedRatio);
  });
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Keeps one subject hue while alternating dark and light tones for adjacent slices. */
export function sameHueDetailColor(baseColor: string, index: number, total: number): string {
  if (total <= 1) return baseColor;
  const pairIndex = Math.floor(index / 2);
  const rank = index % 2 === 0 ? pairIndex : total - 1 - pairIndex;
  const position = rank / (total - 1);
  const darkest = blendHex(baseColor, '#000000', 0.32);
  const lightest = blendHex(baseColor, '#ffffff', 0.72);
  return blendHex(darkest, lightest, position);
}
