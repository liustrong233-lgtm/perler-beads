'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { MappedPixel } from '../utils/pixelation';

interface AssembledPreviewCanvasProps {
  fullPixelGrid: { data: MappedPixel[][]; N: number; M: number } | null;
  chunkLayout: { cols: number; rows: number; colBreaks: number[]; rowBreaks: number[] } | null;
  activeSection: { row: number; col: number } | null;
  onSelectSection: (row: number, col: number) => void;
}

/**
 * 拼接全图预览：在一张完整像素图上叠加切割线和块号标签
 * 先整图像素化（无色差接缝），再叠加切割网格
 */
export default function AssembledPreviewCanvas({
  fullPixelGrid,
  chunkLayout,
  activeSection,
  onSelectSection,
}: AssembledPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalN = fullPixelGrid?.N ?? 0;
  const totalM = fullPixelGrid?.M ?? 0;

  const drawAssembledPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fullPixelGrid || !chunkLayout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // cellSize: 总宽度不超过 700px，每个 cell 至少 2px
    const maxWidth = 700;
    const cellSize = Math.max(2, Math.min(6, Math.floor(maxWidth / totalN)));
    const canvasW = totalN * cellSize;
    const canvasH = totalM * cellSize;

    canvas.width = canvasW;
    canvas.height = canvasH;

    // 1. 绘制全图像素
    for (let y = 0; y < totalM; y++) {
      for (let x = 0; x < totalN; x++) {
        const cell = fullPixelGrid.data[y]?.[x];
        const px = x * cellSize;
        const py = y * cellSize;

        if (cell?.isExternal) {
          ctx.fillStyle = '#E5E7EB';
        } else if (cell?.color) {
          ctx.fillStyle = cell.color;
        } else {
          ctx.fillStyle = '#F3F4F6';
        }
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }

    // 2. 选中块高亮覆盖
    if (activeSection) {
      const { row, col } = activeSection;
      const colStart = col > 0 ? chunkLayout.colBreaks[col - 1] : 0;
      const colEnd = col < chunkLayout.cols - 1 ? chunkLayout.colBreaks[col] : totalN;
      const rowStart = row > 0 ? chunkLayout.rowBreaks[row - 1] : 0;
      const rowEnd = row < chunkLayout.rows - 1 ? chunkLayout.rowBreaks[row] : totalM;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(
        colStart * cellSize, rowStart * cellSize,
        (colEnd - colStart) * cellSize, (rowEnd - rowStart) * cellSize
      );
    }

    // 3. 切割线（比内部网格线更粗更醒目）
    ctx.strokeStyle = 'rgba(0, 100, 220, 0.7)';
    ctx.lineWidth = Math.max(2, Math.round(cellSize * 0.6));

    for (const breakX of chunkLayout.colBreaks) {
      const x = breakX * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
    }
    for (const breakY of chunkLayout.rowBreaks) {
      const y = breakY * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // 4. 外边框
    ctx.strokeStyle = 'rgba(0, 100, 220, 0.9)';
    ctx.lineWidth = Math.max(3, Math.round(cellSize * 0.8));
    ctx.strokeRect(0, 0, canvasW, canvasH);

    // 5. 块号标签
    const labelFontSize = Math.max(11, Math.min(18, Math.round(cellSize * 2.5)));
    ctx.font = `bold ${labelFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < chunkLayout.rows; r++) {
      for (let c = 0; c < chunkLayout.cols; c++) {
        const isActive = activeSection?.row === r && activeSection?.col === c;
        const colStart = c > 0 ? chunkLayout.colBreaks[c - 1] : 0;
        const colEnd = c < chunkLayout.cols - 1 ? chunkLayout.colBreaks[c] : totalN;
        const rowStart = r > 0 ? chunkLayout.rowBreaks[r - 1] : 0;
        const rowEnd = r < chunkLayout.rows - 1 ? chunkLayout.rowBreaks[r] : totalM;

        const cx = (colStart + colEnd) / 2 * cellSize;
        const cy = (rowStart + rowEnd) / 2 * cellSize;
        const labelText = `${r + 1}-${c + 1}`;

        const metrics = ctx.measureText(labelText);
        const pw = metrics.width + 16;
        const ph = labelFontSize + 10;
        const radius = Math.min(6, ph / 3);

        ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.85)' : 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        const rx = cx - pw / 2;
        const ry = cy - ph / 2;
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + pw - radius, ry);
        ctx.quadraticCurveTo(rx + pw, ry, rx + pw, ry + radius);
        ctx.lineTo(rx + pw, ry + ph - radius);
        ctx.quadraticCurveTo(rx + pw, ry + ph, rx + pw - radius, ry + ph);
        ctx.lineTo(rx + radius, ry + ph);
        ctx.quadraticCurveTo(rx, ry + ph, rx, ry + ph - radius);
        ctx.lineTo(rx, ry + radius);
        ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(labelText, cx, cy);
      }
    }
  }, [fullPixelGrid, chunkLayout, activeSection, totalN, totalM]);

  useEffect(() => {
    drawAssembledPreview();
  }, [drawAssembledPreview]);

  // 点击选块：canvas 坐标 → 格子坐标 → 分块行列
  const getSectionFromCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !chunkLayout) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (clientX - rect.left) * scaleX;
    const clickY = (clientY - rect.top) * scaleY;

    const maxWidth = 700;
    const cellSize = Math.max(2, Math.min(6, Math.floor(maxWidth / totalN)));
    const gridX = Math.floor(clickX / cellSize);
    const gridY = Math.floor(clickY / cellSize);

    let col = 0;
    for (const breakX of chunkLayout.colBreaks) {
      if (gridX >= breakX) col++;
      else break;
    }
    let row = 0;
    for (const breakY of chunkLayout.rowBreaks) {
      if (gridY >= breakY) row++;
      else break;
    }

    if (row < chunkLayout.rows && col < chunkLayout.cols) {
      return { row, col };
    }
    return null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = getSectionFromCoords(e.clientX, e.clientY);
    if (result) onSelectSection(result.row, result.col);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.changedTouches[0];
    const result = getSectionFromCoords(touch.clientX, touch.clientY);
    if (result) onSelectSection(result.row, result.col);
  };

  if (!fullPixelGrid || !chunkLayout) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          拼接全图预览 ({chunkLayout.rows}×{chunkLayout.cols} = {chunkLayout.rows * chunkLayout.cols} 块，共 {totalN}×{totalM} 格)
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          — 点击分块切换详情
        </span>
      </div>
      <div className="flex justify-center bg-gray-100 dark:bg-gray-700 rounded-lg p-2 overflow-auto">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onTouchEnd={handleTouchEnd}
          className="max-w-full cursor-pointer rounded"
          style={{ imageRendering: 'pixelated', maxHeight: '500px' }}
        />
      </div>
      {/* 图例 */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5 bg-blue-500/70" style={{ height: '2px' }}></span>
          切割线
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-500/15 border border-blue-400/50"></span>
          当前选中
        </span>
      </div>
    </div>
  );
}
