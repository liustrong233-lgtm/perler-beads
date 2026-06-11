import { transparentColorData } from './pixelEditingUtils';

// 定义像素化模式
export enum PixelationMode {
  Dominant = 'dominant', // 卡通模式（主色）
  Average = 'average',   // 真实模式（平均色）
}

// 定义色号系统类型
export type ColorSystem = 'MARD' | 'COCO' | '漫漫' | '盼盼' | '咪小窝';

// --- 必要的类型定义 ---
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface OklabColor {
  l: number;
  a: number;
  b: number;
}

export interface PaletteColor {
  key: string;
  hex: string;
  rgb: RgbColor;
}

export interface MappedPixel {
  key: string;
  color: string;
  isExternal?: boolean;
}

// --- 辅助函数 ---

// 转换 Hex 到 RGB
export function hexToRgb(hex: string): RgbColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function rgbToOklab(rgb: RgbColor): OklabColor {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    l: 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot,
  };
}

const oklabCache = new Map<string, OklabColor>();

function getOklabColor(rgb: RgbColor): OklabColor {
  const cacheKey = `${rgb.r},${rgb.g},${rgb.b}`;
  const cached = oklabCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const oklab = rgbToOklab(rgb);
  oklabCache.set(cacheKey, oklab);
  return oklab;
}

// Oklab 空间颜色距离（保留，供外部使用）
export function colorDistance(rgb1: RgbColor, rgb2: RgbColor): number {
  const oklab1 = getOklabColor(rgb1);
  const oklab2 = getOklabColor(rgb2);

  const dl = oklab1.l - oklab2.l;
  const da = oklab1.a - oklab2.a;
  const db = oklab1.b - oklab2.b;

  return Math.sqrt(dl * dl + da * da + db * db) * 100;
}

// === CIEDE2000 色差计算（国际照明委员会标准，人眼感知最准） ===

// RGB 转 XYZ
function rgbToXyz(rgb: RgbColor): { x: number; y: number; z: number } {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  r *= 100;
  g *= 100;
  b *= 100;

  return {
    x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    y: r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
    z: r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
  };
}

// XYZ 转 CIELAB
function xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  const fx = xyz.x / refX > 0.008856 ? Math.cbrt(xyz.x / refX) : (903.3 * (xyz.x / refX) + 16) / 116;
  const fy = xyz.y / refY > 0.008856 ? Math.cbrt(xyz.y / refY) : (903.3 * (xyz.y / refY) + 16) / 116;
  const fz = xyz.z / refZ > 0.008856 ? Math.cbrt(xyz.z / refZ) : (903.3 * (xyz.z / refZ) + 16) / 116;

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// CIEDE2000 色差公式
function ciede2000(lab1: { l: number; a: number; b: number }, lab2: { l: number; a: number; b: number }): number {
  const degToRad = Math.PI / 180;
  const radToDeg = 180 / Math.PI;
  const pow25_7 = 6103515625; // 25^7

  const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
  const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
  const cAvg = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt(Math.pow(cAvg, 7) / (Math.pow(cAvg, 7) + pow25_7)));
  const a1p = lab1.a * (1 + g);
  const a2p = lab2.a * (1 + g);

  const c1p = Math.sqrt(a1p * a1p + lab1.b * lab1.b);
  const c2p = Math.sqrt(a2p * a2p + lab2.b * lab2.b);
  const cpAvg = (c1p + c2p) / 2;

  let h1p = Math.atan2(lab1.b, a1p) * radToDeg;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(lab2.b, a2p) * radToDeg;
  if (h2p < 0) h2p += 360;

  let dhCond = h2p - h1p;
  if (Math.abs(dhCond) > 180) {
    if (h2p <= h1p) dhCond += 360; else dhCond -= 360;
  }

  const dhp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhCond * degToRad) / 2);
  const dLp = lab2.l - lab1.l;
  const dCp = c2p - c1p;

  let hpAvg = (h1p + h2p) / 2;
  if (Math.abs(h1p - h2p) > 180) {
    hpAvg = (h1p + h2p + 360) / 2;
  }

  const t = 1 - 0.17 * Math.cos((hpAvg - 30) * degToRad)
    + 0.24 * Math.cos((2 * hpAvg) * degToRad)
    + 0.32 * Math.cos((3 * hpAvg + 6) * degToRad)
    - 0.20 * Math.cos((4 * hpAvg - 63) * degToRad);

  const sl = 1 + (0.015 * Math.pow(lab1.l - 50, 2)) / Math.sqrt(20 + Math.pow(lab1.l - 50, 2));
  const sc = 1 + 0.045 * cpAvg;
  const sh = 1 + 0.015 * cpAvg * t;

  const rtDeg = 30 * Math.exp(-Math.pow((hpAvg - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(cpAvg, 7) / (Math.pow(cpAvg, 7) + pow25_7));
  const rt = -rc * Math.sin(2 * rtDeg * degToRad);

  const kl = 1, kc = 1, kh = 1;
  const termL = dLp / (kl * sl);
  const termC = dCp / (kc * sc);
  const termH = dhp / (kh * sh);

  return Math.sqrt(termL * termL + termC * termC + termH * termH + rt * termC * termH);
}

// CIEDE2000 色差缓存
const ciede2000Cache = new Map<string, number>();

// CIEDE2000 颜色距离（可选替 Oklab，感知更准）
export function colorDistanceCiede2000(rgb1: RgbColor, rgb2: RgbColor): number {
  const key = `${rgb1.r},${rgb1.g},${rgb1.b}|${rgb2.r},${rgb2.g},${rgb2.b}`;
  const cached = ciede2000Cache.get(key);
  if (cached !== undefined) return cached;

  const lab1 = xyzToLab(rgbToXyz(rgb1));
  const lab2 = xyzToLab(rgbToXyz(rgb2));
  const result = ciede2000(lab1, lab2);

  ciede2000Cache.set(key, result);
  return result;
}

// 查找最接近的颜色（默认用 CIEDE2000，保留 Oklab 兼容）
export function findClosestPaletteColor(
  targetRgb: RgbColor,
  palette: PaletteColor[],
  useCiede2000: boolean = true
): PaletteColor {
  if (!palette || palette.length === 0) {
      console.error("findClosestPaletteColor: Palette is empty or invalid!");
      return { key: 'ERR', hex: '#000000', rgb: { r: 0, g: 0, b: 0 } };
  }

  const distanceFn = useCiede2000 ? colorDistanceCiede2000 : colorDistance;
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const paletteColor of palette) {
    const distance = distanceFn(targetRgb, paletteColor.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = paletteColor;
    }
    if (distance === 0) break; // 完全匹配，提前退出
  }
  return closestColor;
}


// --- 核心像素化计算逻辑 ---

/**
 * 计算图像指定区域的代表色（根据所选模式）
 */
function calculateCellRepresentativeColor(
    imageData: ImageData,
    startX: number,
    startY: number,
    width: number,
    height: number,
    mode: PixelationMode
): RgbColor | null {
    const data = imageData.data;
    const imgWidth = imageData.width;
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;
    const colorCountsInCell: { [key: string]: number } = {};
    let dominantColorRgb: RgbColor | null = null;
    let maxCount = 0;

    const endX = startX + width;
    const endY = startY + height;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const index = (y * imgWidth + x) * 4;
            if (data[index + 3] < 128) continue;

            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            pixelCount++;

            if (mode === PixelationMode.Average) {
                rSum += r;
                gSum += g;
                bSum += b;
            } else {
                const colorKey = `${r},${g},${b}`;
                colorCountsInCell[colorKey] = (colorCountsInCell[colorKey] || 0) + 1;
                if (colorCountsInCell[colorKey] > maxCount) {
                    maxCount = colorCountsInCell[colorKey];
                    dominantColorRgb = { r, g, b };
                }
            }
        }
    }

    if (pixelCount === 0) {
        return null;
    }

    if (mode === PixelationMode.Average) {
        return {
            r: Math.round(rSum / pixelCount),
            g: Math.round(gSum / pixelCount),
            b: Math.round(bSum / pixelCount),
        };
    } else {
        return dominantColorRgb;
    }
}

// === Floyd-Steinberg 抖动算法 ===

// 抖动误差扩散权重（标准 Floyd-Steinberg）
//      *   7/16
//  3/16  5/16  1/16
const DITHER_WEIGHTS = [
  { dr: 0, dc: 1, weight: 7 / 16 },
  { dr: 1, dc: -1, weight: 3 / 16 },
  { dr: 1, dc: 0, weight: 5 / 16 },
  { dr: 1, dc: 1, weight: 1 / 16 },
];

/**
 * 对已计算的理想 RGB 网格执行 Floyd-Steinberg 抖动
 * 将每个格子的量化误差扩散到邻居，使人眼感知更平滑
 */
function applyFloydSteinbergDither(
  idealRgbGrid: (RgbColor | null)[][],
  N: number,
  M: number,
  palette: PaletteColor[],
): MappedPixel[][] {
  // 初始化误差缓冲区（每个像素的 RGB 累计误差）
  const errorBuf: { r: number; g: number; b: number }[][] = Array(M)
    .fill(null)
    .map(() => Array(N).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));

  const result: MappedPixel[][] = Array(M).fill(null).map(() => Array(N));

  for (let row = 0; row < M; row++) {
    for (let col = 0; col < N; col++) {
      const idealRgb = idealRgbGrid[row][col];

      if (!idealRgb) {
        // 空单元格（透明区域），跳过
        result[row][col] = { ...transparentColorData };
        continue;
      }

      // 加累积误差到理想色（限制在 0-255 范围内）
      const err = errorBuf[row][col];
      const adjustedRgb: RgbColor = {
        r: Math.max(0, Math.min(255, Math.round(idealRgb.r + err.r))),
        g: Math.max(0, Math.min(255, Math.round(idealRgb.g + err.g))),
        b: Math.max(0, Math.min(255, Math.round(idealRgb.b + err.b))),
      };

      // 用 CIEDE2000 找最近色板色
      const closestBead = findClosestPaletteColor(adjustedRgb, palette, true);

      // 计算量化误差（理想色 - 实际选中的色板色）
      const quantErr = {
        r: idealRgb.r - closestBead.rgb.r,
        g: idealRgb.g - closestBead.rgb.g,
        b: idealRgb.b - closestBead.rgb.b,
      };

      // 将误差按 Floyd-Steinberg 权重扩散到邻居
      for (const { dr, dc, weight } of DITHER_WEIGHTS) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < M && nc >= 0 && nc < N) {
          errorBuf[nr][nc].r += quantErr.r * weight;
          errorBuf[nr][nc].g += quantErr.g * weight;
          errorBuf[nr][nc].b += quantErr.b * weight;
        }
      }

      result[row][col] = { key: closestBead.key, color: closestBead.hex };
    }
  }

  return result;
}

// === 图片预处理 ===

/**
 * 使用 Canvas API 对原图做锐化 + 对比度增强
 * 纯客户端处理，不依赖任何外部 API
 */
export function preprocessImage(
  ctx: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  sharpenStrength: number = 2, // 0-5，0=不锐化
): void {
  if (sharpenStrength <= 0) return;

  const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
  const data = imageData.data;
  const w = imgWidth;
  const h = imgHeight;

  // 克隆一份原始数据用于卷积读取
  const src = new Uint8ClampedArray(data);

  // 锐化卷积核：中心权重 = 4 * strength + 1，四周 = -strength
  const centerWeight = 4 * sharpenStrength + 1;
  const sideWeight = -sharpenStrength;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) { // 只处理 RGB，不碰 Alpha
        const idx = (y * w + x) * 4 + c;
        const top    = src[((y - 1) * w + x) * 4 + c];
        const bottom = src[((y + 1) * w + x) * 4 + c];
        const left   = src[(y * w + (x - 1)) * 4 + c];
        const right  = src[(y * w + (x + 1)) * 4 + c];
        const center = src[idx];

        let val = centerWeight * center
          + sideWeight * (top + bottom + left + right);

        // 限制在 0-255
        val = Math.max(0, Math.min(255, val));
        data[idx] = val;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 根据原始图像数据、网格尺寸、调色板和模式计算像素化网格数据。
 *
 * @param originalCtx 原始图像的 Canvas 2D Context
 * @param imgWidth 原始图像宽度
 * @param imgHeight 原始图像高度
 * @param N 网格横向数量
 * @param M 网格纵向数量
 * @param palette 当前使用的调色板
 * @param mode 像素化模式 (Dominant/Average)
 * @param t1FallbackColor 备用颜色数据
 * @param useDithering 是否启用 Floyd-Steinberg 抖动（默认 true）
 * @returns 计算后的 MappedPixel 网格数据
 */
export function calculatePixelGrid(
    originalCtx: CanvasRenderingContext2D,
    imgWidth: number,
    imgHeight: number,
    N: number,
    M: number,
    palette: PaletteColor[],
    mode: PixelationMode,
    t1FallbackColor: PaletteColor,
    useDithering: boolean = true,
): MappedPixel[][] {
    console.log(`Calculating pixel grid | mode: ${mode} | dithering: ${useDithering}`);
    const cellWidthOriginal = imgWidth / N;
    const cellHeightOriginal = imgHeight / M;

    let fullImageData: ImageData | null = null;
    try {
        fullImageData = originalCtx.getImageData(0, 0, imgWidth, imgHeight);
    } catch (e) {
        console.error("Failed to get full image data:", e);
        const mappedData: MappedPixel[][] = Array(M).fill(null).map(() =>
          Array(N).fill({ key: t1FallbackColor.key, color: t1FallbackColor.hex })
        );
        return mappedData;
    }

    // 第一步：计算每个格子的理想 RGB
    const idealRgbGrid: (RgbColor | null)[][] = Array(M).fill(null).map(() => Array(N).fill(null));

    for (let j = 0; j < M; j++) {
        for (let i = 0; i < N; i++) {
            const startXOriginal = Math.floor(i * cellWidthOriginal);
            const startYOriginal = Math.floor(j * cellHeightOriginal);
            const endXOriginal = Math.min(imgWidth, Math.ceil((i + 1) * cellWidthOriginal));
            const endYOriginal = Math.min(imgHeight, Math.ceil((j + 1) * cellHeightOriginal));
            const currentCellWidth = Math.max(1, endXOriginal - startXOriginal);
            const currentCellHeight = Math.max(1, endYOriginal - startYOriginal);

            const representativeRgb = calculateCellRepresentativeColor(
                fullImageData,
                startXOriginal,
                startYOriginal,
                currentCellWidth,
                currentCellHeight,
                mode
            );

            idealRgbGrid[j][i] = representativeRgb;
        }
    }

    // 第二步：用抖动算法（或直接映射）确定每个格子的最终色板色
    if (useDithering) {
        console.log("Applying Floyd-Steinberg dithering...");
        return applyFloydSteinbergDither(idealRgbGrid, N, M, palette);
    } else {
        // 不抖动：直接映射（改为 CIEDE2000）
        const defaultCell: MappedPixel = { key: t1FallbackColor.key, color: t1FallbackColor.hex };
        const mappedData: MappedPixel[][] = Array(M).fill(null).map(() =>
          Array(N).fill(defaultCell)
        );

        for (let j = 0; j < M; j++) {
            for (let i = 0; i < N; i++) {
                const representativeRgb = idealRgbGrid[j][i];
                if (representativeRgb) {
                    const closestBead = findClosestPaletteColor(representativeRgb, palette, true);
                    mappedData[j][i] = { key: closestBead.key, color: closestBead.hex };
                } else {
                    mappedData[j][i] = { ...transparentColorData };
                }
            }
        }
        console.log("Direct mapping complete (dithering off)");
        return mappedData;
    }
}
