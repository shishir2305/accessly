import sharp from "sharp";
export async function maskImage(
  image: Buffer,
  boxes: { x: number; y: number; width: number; height: number }[],
) {
  const metadata = await sharp(image, {
    limitInputPixels: 32_000_000,
  }).metadata();
  const width = metadata.width!,
    height = metadata.height!;
  const overlays = [];
  for (const box of boxes) {
    const left = Math.max(0, Math.floor(box.x)),
      top = Math.max(0, Math.floor(box.y));
    const right = Math.min(width, Math.ceil(box.x + box.width)),
      bottom = Math.min(height, Math.ceil(box.y + box.height));
    if (right <= left || bottom <= top) continue;
    overlays.push({
      input: await sharp({
        create: {
          width: right - left,
          height: bottom - top,
          channels: 4,
          background: "#111827",
        },
      })
        .png()
        .toBuffer(),
      left,
      top,
    });
  }
  return sharp(image, { limitInputPixels: 32_000_000 })
    .composite(overlays)
    .png()
    .toBuffer();
}
