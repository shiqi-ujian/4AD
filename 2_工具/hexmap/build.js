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

// 6. 验证 brace 平衡
const jsLines = jsContent.split('\n');
let braceCount = 0;
let inString = false, stringChar = null, inBlockComment = false;
for (const line of jsLines) {
  let j = 0;
  while (j < line.length) {
    const c = line[j], n = line[j + 1] || '';
    if (inBlockComment) {
      if (c === '*' && n === '/') { inBlockComment = false; j += 2; }
      else j++;
      continue;
    }
    if (!inString && c === '/' && n === '*') { inBlockComment = true; j += 2; continue; }
    if (!inString && c === '/' && n === '/') break;
    if (inString) {
      if (c === '\\') { j += 2; continue; }
      if (c === stringChar) inString = false;
      j++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; j++; continue; }
    if (c === '{') braceCount++;
    if (c === '}') braceCount--;
    j++;
  }
}

const stats = fs.statSync(outputPath);
console.log(`\n✅ 打包完成: ${outputPath}`);
console.log(`   文件大小: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`   JS 行数: ${jsLines.length}`);
console.log(`   大括号平衡: ${braceCount === 0 ? '✅ 通过' : '❌ 不平衡 (' + braceCount + ')'}`);

if (braceCount !== 0) {
  console.log('\n⚠️  警告: 大括号不平衡，请检查最近修改的 JS 文件！');
  process.exit(1);
}
