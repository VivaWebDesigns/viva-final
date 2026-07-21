import sharp from "sharp";

export type HeatmapCrop = {
  left: number;
  top: number;
  width: number;
  height: number;
  detectedMarkerCount: number;
};

type MarkerComponent = {
  area: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const TARGET_MAP_ASPECT = 1000 / 960;

function isMarkerPixel(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha < 180 || green < 58 || blue > 135) return false;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  if (max - min < 48) return false;

  const greenOrOlive = green > blue + 38 && green >= red * 0.72;
  const yellowOrOrange = red > 145 && green > 78 && red > blue + 80 && green > blue + 55;
  return greenOrOlive || yellowOrOrange;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function findMarkerComponents(data: Buffer, width: number, height: number, channels: number): MarkerComponent[] {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    if (isMarkerPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3] ?? 255)) {
      mask[index] = 1;
    }
  }

  const queue = new Int32Array(width * height);
  const components: MarkerComponent[] = [];
  const minDimension = Math.max(9, Math.round(Math.min(width, height) * 0.018));
  const maxDimension = Math.round(Math.min(width, height) * 0.16);

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0) continue;
    let head = 0;
    let tail = 0;
    let area = 0;
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;
    queue[tail++] = start;
    mask[start] = 0;

    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (mask[next] === 0) continue;
          mask[next] = 0;
          queue[tail++] = next;
        }
      }
    }

    const componentWidth = right - left + 1;
    const componentHeight = bottom - top + 1;
    const aspect = componentWidth / componentHeight;
    const fill = area / (componentWidth * componentHeight);
    if (
      componentWidth >= minDimension
      && componentHeight >= minDimension
      && componentWidth <= maxDimension
      && componentHeight <= maxDimension
      && aspect >= 0.68
      && aspect <= 1.48
      && fill >= 0.32
    ) {
      components.push({
        area,
        left,
        top,
        right,
        bottom,
        width: componentWidth,
        height: componentHeight,
      });
    }
  }

  if (components.length < 5) return components;
  const medianWidth = median(components.map((component) => component.width));
  const medianHeight = median(components.map((component) => component.height));
  const medianArea = median(components.map((component) => component.area));
  const sizeMatched = components.filter((component) => (
    component.width >= medianWidth * 0.65
    && component.width <= medianWidth * 1.45
    && component.height >= medianHeight * 0.65
    && component.height <= medianHeight * 1.45
    && component.area >= medianArea * 0.4
    && component.area <= medianArea * 2.2
  ));
  return sizeMatched.length >= 5 ? sizeMatched : components;
}

export async function detectHeatmapCrop(buffer: Buffer): Promise<HeatmapCrop | null> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const markers = findMarkerComponents(data, width, height, channels);
  if (markers.length < 5) return null;

  const left = Math.min(...markers.map((marker) => marker.left));
  const top = Math.min(...markers.map((marker) => marker.top));
  const right = Math.max(...markers.map((marker) => marker.right));
  const bottom = Math.max(...markers.map((marker) => marker.bottom));
  const gridWidth = right - left + 1;
  const gridHeight = bottom - top + 1;
  const markerSize = median(markers.map((marker) => Math.max(marker.width, marker.height)));
  const horizontalPadding = Math.max(gridWidth * 0.22, markerSize * 1.5);
  const verticalPadding = Math.max(gridHeight * 0.22, markerSize * 1.5);

  let cropWidth = gridWidth + horizontalPadding * 2;
  let cropHeight = gridHeight + verticalPadding * 2;
  if (cropWidth / cropHeight < TARGET_MAP_ASPECT) cropWidth = cropHeight * TARGET_MAP_ASPECT;
  else cropHeight = cropWidth / TARGET_MAP_ASPECT;

  const fitScale = Math.min(1, width / cropWidth, height / cropHeight);
  cropWidth *= fitScale;
  cropHeight *= fitScale;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const integerWidth = Math.max(1, Math.min(width, Math.round(cropWidth)));
  const integerHeight = Math.max(1, Math.min(height, Math.round(cropHeight)));
  const integerLeft = Math.max(0, Math.min(width - integerWidth, Math.round(centerX - integerWidth / 2)));
  const integerTop = Math.max(0, Math.min(height - integerHeight, Math.round(centerY - integerHeight / 2)));

  return {
    left: integerLeft,
    top: integerTop,
    width: integerWidth,
    height: integerHeight,
    detectedMarkerCount: markers.length,
  };
}

export async function cropHeatmapAroundGrid(buffer: Buffer): Promise<{ buffer: Buffer; crop: HeatmapCrop } | null> {
  const crop = await detectHeatmapCrop(buffer);
  if (!crop) return null;
  const cropped = await sharp(buffer)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .png({ compressionLevel: 8 })
    .toBuffer();
  return { buffer: cropped, crop };
}
