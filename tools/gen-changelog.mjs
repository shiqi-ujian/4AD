// ============================================================
// 更新日志页生成器（4AD）：由 tools/changelog.json 渲染 web/更新日志.html。
//   node tools/gen-changelog.mjs
// 页面发布源 = web/（deploy-pages.yml 会 cp -r web/* 到 _site）
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const data = JSON.parse(fs.readFileSync(path.join(HERE, 'changelog.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const entryHtml = (e) => {
  const fixes = (e.fixes || []).map((f) =>
    `<li><strong>${esc(f.title)}</strong>${f.page ? `（${esc(f.page)}）` : ''}<br><span class="d">${esc(f.detail || '')}</span><span class="id">#${esc(f.id)}</span></li>`
  ).join('\n      ');
  const pend = (e.pending || []).map((p) =>
    `<li><strong>${esc(p.title)}</strong> — 待确认：${esc(p.note || '')}<span class="id">#${esc(p.id)}</span></li>`
  ).join('\n      ');
  return `<section>
    <h2>${esc(e.date)}${e.version ? ` · v${esc(e.version)}` : ''}</h2>
    <p class="release">${esc(e.release || '')}</p>
    ${fixes ? `<h3>✅ 已修复</h3><ul>\n      ${fixes}\n    </ul>` : ''}
    ${pend ? `<h3>⏳ 待确认</h3><ul>\n      ${pend}\n    </ul>` : ''}
  </section>`;
};

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>更新日志 · 4AD 工具站</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px 16px 64px; line-height: 1.7; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 26px; letter-spacing: 2px; }
  a { color: #7dd3fc; }
  section { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px 20px; margin: 16px 0; }
  h2 { font-size: 18px; margin: 0 0 6px; color: #fff; }
  h3 { font-size: 14px; margin: 12px 0 4px; color: #86efac; }
  .release { color: #94a3b8; font-size: 13px; margin: 0 0 8px; }
  ul { margin: 0; padding-left: 20px; }
  li { margin: 6px 0; }
  .d { color: #94a3b8; font-size: 13px; }
  .id { color: #64748b; font-size: 12px; margin-left: 8px; }
  .back { display: inline-block; margin-bottom: 12px; }
</style>
</head>
<body>
<main>
  <a class="back" href="index.html">← 返回工具首页</a>
  <h1>🔧 更新日志</h1>
  <p style="color:#94a3b8;font-size:13px">本页由系统在每次修复发布后自动更新。来源：QQ 群收集表提交的问题。历史修复见下（最新在上）。</p>
  ${data.entries.map(entryHtml).join('\n  ')}
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'web', '更新日志.html'), html, 'utf8');
console.log('[gen-changelog] web/更新日志.html 已生成，entries =', data.entries.length);
