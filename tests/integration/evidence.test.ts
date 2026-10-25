import { it, expect } from "vitest";
import sharp from "sharp";
import { maskImage } from "../../apps/worker/src/evidence";
it("masks only the clipped sensitive region without altering the assessed DOM", async () => {
  const original = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const masked = await maskImage(original, [
    { x: -2, y: 1, width: 5, height: 4 },
  ]);
  const { data, info } = await sharp(masked)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [
    ...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
  ];
  expect(pixel(0, 1)).toEqual([17, 24, 39]);
  expect(pixel(2, 4)).toEqual([17, 24, 39]);
  expect(pixel(3, 4)).toEqual([255, 255, 255]);
  expect(pixel(0, 0)).toEqual([255, 255, 255]);
});
