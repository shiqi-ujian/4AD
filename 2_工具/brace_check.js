/**
 * hexmap.html 大括号平衡检查器
 * 用法: node brace_check.js
 * 输出: 最终 brace count，最后归零的行号
 *
 * 如果 count !== 0，说明 JS 大括号不平衡，地图会白屏。
 * 从 lastZeroLine 之后寻找缺失的 "{" 或 "}"。
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'hexmap.html'), 'utf8');
const lines = html.split('\n');

// 找到 JS 起始行
const scriptStart = lines.findIndex(l =>
  l.trim().startsWith('<script') && !l.trim().startsWith('</script')
);

if (scriptStart === -1) {
  console.error('未找到 <script> 标签');
  process.exit(1);
}

console.log('Script start: HTML line', scriptStart + 1);
console.log('');

// === 模式 A：快速总览 ===
let braceCount = 0;
let inString = false, stringChar = null, inBlockComment = false;
let lastZeroLine = -1;

for (let i = scriptStart; i < lines.length; i++) {
  const line = lines[i];
  let j = 0;
  while (j < line.length) {
    const ch = line[j];
    const nextCh = line[j + 1] || '';

    if (inBlockComment) {
      if (ch === '*' && nextCh === '/') { inBlockComment = false; j += 2; }
      else { j++; }
      continue;
    }
    if (!inString && ch === '/' && nextCh === '*') { inBlockComment = true; j += 2; continue; }
    if (!inString && ch === '/' && nextCh === '/') { break; }
    if (inString) {
      if (ch === '\\') { j += 2; continue; }
      if (ch === stringChar) { inString = false; }
      j++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; j++; continue; }
    if (ch === '{') braceCount++;
    if (ch === '}') braceCount--;
    j++;
  }
  if (braceCount === 0) lastZeroLine = i;
}

console.log('===== 快速检查 =====');
console.log('Brace count:', braceCount);
console.log('Last zero line:', lastZeroLine + 1);

if (braceCount === 0) {
  console.log('✓ 大括号平衡');
  process.exit(0);
}

// === 模式 B：详细追踪变更点 ===
console.log('');
console.log('===== 大括号变化追踪 =====');

braceCount = 0;
inString = false; stringChar = null; inBlockComment = false;

for (let i = scriptStart; i < lines.length; i++) {
  const line = lines[i];
  const prevBraceCount = braceCount;
  let j = 0;
  while (j < line.length) {
    const ch = line[j];
    const nextCh = line[j + 1] || '';

    if (inBlockComment) {
      if (ch === '*' && nextCh === '/') { inBlockComment = false; j += 2; }
      else { j++; }
      continue;
    }
    if (!inString && ch === '/' && nextCh === '*') { inBlockComment = true; j += 2; continue; }
    if (!inString && ch === '/' && nextCh === '/') { break; }
    if (inString) {
      if (ch === '\\') { j += 2; continue; }
      if (ch === stringChar) { inString = false; }
      j++; continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; j++; continue; }
    if (ch === '{') braceCount++;
    if (ch === '}') braceCount--;
    j++;
  }
  if (braceCount !== prevBraceCount) {
    const snippet = line.trim().substring(0, 80);
    console.log(`L${i + 1}: ${prevBraceCount} → ${braceCount}  | ${snippet}`);
  }
}

console.log('');
console.log('查找建议：从 lastZeroLine 之后的第一个 "{" 开始检查每个块是否闭合。');