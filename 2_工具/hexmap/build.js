// build.js — 将模块化文件合并为单个可分发的 hexmap.html
// 用法: node build.js
// 输出: ../hexmap.html（覆盖）

const fs = require('fs');
const path = require('path');

// 1. 读取 index.html（HTML + CSS + script 标签之前的部分）
let indexContent = fs.readFileSync('index.html', 'utf8');

// 2. 找到所有 <script src="..."> 标签，按顺序读取并内联
const scriptRegex = /<script src="(js\/[^"]+)"><\/script>/g;
const scripts = [];
let match;
while ((match = scriptRegex.exec(indexContent)) !== null) {
  scripts.push(match[1]);
}

if (scripts.length === 0) {
  console.error('错误: 未在 index.html 中找到 <script src="..."> 标签');
  process.exit(1);
}

console.log(`找到 ${scripts.length} 个 JS 模块:`);
scripts.forEach(s => console.log(`  - ${s}`));

// 3. 读取每个 JS 文件
let jsContent = '';
for (const scriptPath of scripts) {
  if (!fs.existsSync(scriptPath)) {
    console.error(`错误: 文件不存在: ${scriptPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(scriptPath, 'utf8');
  jsContent += content + '\n';
}

// 4. 替换 <script src="..."> 标签为内联 <script>
//    先移除所有 script src 标签，然后插入内联脚本
let output = indexContent.replace(/<script src="js\/[^"]+"><\/script>\n?/g, '');
// 在 </body> 之前插入内联脚本
output = output.replace('</body>', '<script>\n' + jsContent + '</script>\n</body>');

// 5. 写入输出文件
const outputPath = path.join('..', 'hexmap.html');
fs.writeFileSync(outputPath, output, 'utf8');

// 6. 验证 JS 语法 + brace 平衡
// Use a real JS parse (new Function) — far more reliable than hand-rolling a
// brace counter, which gets confused by regex literals that contain `"` or
// `{`/`}` (e.g. escHtml's .replace(/"/g), ai.js's {...} extraction regex).
let syntaxOk = true, braceCount = 0, parseError = null;
try {
  new Function(jsContent);
} catch (e) {
  syntaxOk = false;
  parseError = e;
  // Fall back to a best-effort brace count for the error message
  for (let ch of jsContent) {
    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
  }
}

const stats = fs.statSync(outputPath);
console.log(`\n✅ 打包完成: ${outputPath}`);
console.log(`   文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`   JS 行数: ${jsContent.split('\n').length}`);
if (syntaxOk) {
  console.log('   JS 语法: ✅ 通过');
} else {
  console.log(`   JS 语法: ❌ 错误 (${parseError.message})`);
}

if (!syntaxOk || braceCount !== 0) {
  console.log('\n⚠️  警告: JS 语法或大括号不平衡，请检查最近修改的 JS 文件！');
  process.exit(1);
}
