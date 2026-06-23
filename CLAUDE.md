# 一头小猪拼豆底稿生成器

在线地址：https://perler-beads-bn0.pages.dev
GitHub：`liustrong233-lgtm/perler-beads`（master 分支）

## 技术栈

Next.js 15 静态导出 + TypeScript + Tailwind CSS，部署在 Cloudflare Pages。
全部功能在浏览器端运行，无后端。

## 核心文件

| 文件 | 职责 |
|------|------|
| `src/utils/pixelation.ts` | 像素化引擎：CIEDE2000 颜色匹配、Floyd-Steinberg 抖动、图片预处理锐化 |
| `src/app/page.tsx` | 主页面 UI：上传、控制面板、使用说明、手动编辑、下载、大图分块模式 |
| `src/utils/colorSystemUtils.ts` | 多色号系统映射（MARD/COCO/漫漫/盼盼/咪小窝） |
| `src/utils/imageDownloader.ts` | 图纸下载（PNG + CSV），支持分块标签 |

## 部署

```bash
npm run build    # 构建静态文件到 out/
git push origin master  # Cloudflare Pages 自动部署
```

## 设计约束

- 全免费，不接任何付费 API
- 中国大陆可访问（不用 Vercel）
- 品牌：一头小猪
- 所有第三方品牌/链接/弹窗已移除

## 已实现功能

- CIEDE2000 人眼感知色差匹配（取代 RGB 欧几里得距离）
- Floyd-Steinberg 误差扩散抖动（渐变更平滑）
- 图片预处理锐化（可调强度 0-5）
- 大图分块模式：原图不缩放，切成多块小板独立处理下载
- 5 套色号系统映射（MARD/COCO/漫漫/盼盼/咪小窝）
- 手动编辑模式（逐格改色、颜色替换、擦除、放大镜）
- 一键去背景、颜色排除/恢复
- 使用说明折叠面板
- 下载图纸含坐标、网格线、材料清单，支持 CSV 导入导出
