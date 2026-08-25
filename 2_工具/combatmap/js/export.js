//  Export: Excel
//  主格式 = .xlsx（标准 OOXML，Excel/WPS 都支持颜色与方正规格）
//  降级   = .xls（HTML 表格，仅当 SheetJS 未加载时使用）
// ============================================================
async function exportToExcel() {
  cleanData();
  const keys = Object.keys(combatData);
  if (keys.length === 0) { showToast('⚠️ 没有数据可导出，先生成地图！'); return; }

  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  keys.forEach(k => {
    const [q, r] = k.split(',').map(Number);
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  });
  minQ--; maxQ++; minR--; maxR++;

  if (typeof XLSX === 'undefined') {
    // SheetJS 未加载（离线）：降级 .xls
    exportStyledHTML(minQ, maxQ, minR, maxR);
    showToast('⚠️ xlsx 组件未加载（需联网），已导出 .xls（颜色兼容性有限，建议联网后用 xlsx）');
    return;
  }
  try {
    await exportMultiSheetXLSX(minQ, maxQ, minR, maxR);
  } catch (err) {
    console.error(err);
    exportStyledHTML(minQ, maxQ, minR, maxR);
    showToast('⚠️ xlsx 导出失败（' + (err?.message || '未知错误') + '），已降级 .xls');
  }
}

function exportStyledHTML(minQ, maxQ, minR, maxR) {
  const cols = maxQ - minQ + 1;
  const rows = maxR - minR + 1;

  // Compact legend as a text note (no separate table to prevent column stretch)
  const legendIcons = [];
  getTerrainList().forEach(id => {
    const t = getTerrain(id);
    legendIcons.push(t.icon + ' ' + t.name);
  });

  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">\n';
  html += '<head><meta charset="UTF-8">\n';
  html += '<!--[if gte mso 9]><xml>\n';
  html += '<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>\n';
  html += '<x:Name>战斗地图</x:Name>\n';
  html += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>\n';
  html += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>\n';
  html += '</xml><![endif]-->\n';
  html += '<style>\n';
  html += '  table { border-collapse: collapse; }\n';
  html += '  td {\n';
  html += '    width: 36pt; height: 36pt;\n';           // 36pt = 48px，方正格子
  html += '    min-width: 36pt; min-height: 36pt;\n';
  html += '    text-align: center; vertical-align: middle;\n';
  html += '    font-size: 20px; padding: 0; margin: 0;\n';
  html += '    mso-width-source: userset; mso-height-source: userset;\n';
  html += '  }\n';
  html += '  .hd {\n';
  html += '    background: #1a1a2e; color: #aaa; font-weight: bold; font-size: 10px;\n';
  html += '    width: 36pt; height: 36pt;\n';
  html += '  }\n';
  html += '  .wall-top    { border-top:    4px solid #000000 !important; }\n';
  html += '  .wall-right  { border-right:  4px solid #000000 !important; }\n';
  html += '  .wall-bottom { border-bottom: 4px solid #000000 !important; }\n';
  html += '  .wall-left   { border-left:   4px solid #000000 !important; }\n';
  html += '  .door-top    { border-top:    4px dashed #5a3a15 !important; }\n';
  html += '  .door-right  { border-right:  4px dashed #5a3a15 !important; }\n';
  html += '  .door-bottom { border-bottom: 4px dashed #5a3a15 !important; }\n';
  html += '  .door-left   { border-left:   4px dashed #5a3a15 !important; }\n';
  html += '  .lbl { display:inline-block; margin-top:2px; padding:1px 3px; background:#1a1a1a; color:#ffd700; font-weight:bold; font-size:11px; line-height:1.2; border:1px solid #ffd700; border-radius:2px; }\n';
  html += '  .door-icon { display:block; font-size:15px; line-height:1; margin-top:-2px; }\n';
  html += '  .legend { font-size: 10px; color: #aaa; margin: 2px 0; }\n';
  html += '</style>\n</head><body>\n';
  html += '<h2 style="margin:0 0 2px;">⚔️ 战斗地图</h2>\n';
  const legendChunks = [];
  for (let i = 0; i < legendIcons.length; i += 8) legendChunks.push(legendIcons.slice(i, i + 8).join(' | '));
  html += '<p class="legend">🖌️ 图例（颜色+图标）:<br>' + legendChunks.join('<br>') + '</p>\n';
  html += '<p class="legend">🧱 粗黑边框 = 墙壁 | 🚪 深棕粗虚线+图标 = 门 | 灰线 = 网格</p>\n';
  html += '<table border="1" cellpadding="0" cellspacing="0">\n';

  // Column definitions（36pt = 48px 方正）
  html += '<colgroup>\n';
  html += '<col style="width:36pt;min-width:36pt;">\n';
  for (let c = 0; c < cols; c++) {
    html += '<col style="width:36pt;min-width:36pt;">\n';
  }
  html += '</colgroup>\n';

  // Header row
  html += '<tr style="height:36pt;">\n';
  html += '<td class="hd" style="width:36pt;height:36pt;"></td>\n';
  for (let c = 0; c < cols; c++) {
    html += '<td class="hd" style="width:36pt;height:36pt;">' + colLetter(minQ + c) + '</td>\n';
  }
  html += '</tr>\n';

  // Data rows
  for (let ri = 0; ri < rows; ri++) {
    const r = minR + ri;
    html += '<tr style="height:36pt;">\n';
    html += '<td class="hd" style="width:36pt;height:36pt;">' + r + '</td>\n';
    for (let ci = 0; ci < cols; ci++) {
      const q = minQ + ci;
      const h = getCell(q, r);
      const ti = h.terrain ? getTerrain(h.terrain) : null;
      const bg = ti ? ti.color : '#ffffff';
      const icon = ti ? ti.icon : '';
      const label = h.label || '';

      const walls = h.walls || [0,0,0,0];
      const classes = [];
      const inlineBorders = [];
      if (walls[0] === 1) { classes.push('wall-top'); inlineBorders.push('border-top:4px solid #000000'); }
      else if (walls[0] === 2) { classes.push('door-top'); inlineBorders.push('border-top:4px dashed #5a3a15'); }
      if (walls[1] === 1) { classes.push('wall-right'); inlineBorders.push('border-right:4px solid #000000'); }
      else if (walls[1] === 2) { classes.push('door-right'); inlineBorders.push('border-right:4px dashed #5a3a15'); }
      if (walls[2] === 1) { classes.push('wall-bottom'); inlineBorders.push('border-bottom:4px solid #000000'); }
      else if (walls[2] === 2) { classes.push('door-bottom'); inlineBorders.push('border-bottom:4px dashed #5a3a15'); }
      if (walls[3] === 1) { classes.push('wall-left'); inlineBorders.push('border-left:4px solid #000000'); }
      else if (walls[3] === 2) { classes.push('door-left'); inlineBorders.push('border-left:4px dashed #5a3a15'); }
      const cls = classes.length > 0 ? ' class="' + classes.join(' ') + '"' : '';
      const bdStyle = inlineBorders.length > 0 ? inlineBorders.join(';') + ';' : '';

      let inner = icon;
      // 门：单元格内加醒目门图标（配合加粗虚线边框）
      const hasDoor = (walls[0] === 2) || (walls[1] === 2) || (walls[2] === 2) || (walls[3] === 2);
      if (hasDoor) inner += '<span class="door-icon">🚪</span>';
      if (label) {
        inner += '<br><span class="lbl">' + escHtml(label) + '</span>';
      }

      // bgcolor 属性 + inline background/边框 双保险（WPS 兼容）
      html += '<td' + cls + ' bgcolor="' + bg + '" style="width:36pt;height:36pt;background:' + bg + ';' + bdStyle + '">' + inner + '</td>\n';
    }
    html += '</tr>\n';
  }

  html += '</table>\n</body></html>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  downloadBlob(blob, 'combatmap_' + new Date().toISOString().slice(0,10) + '.xls');
  showToast('📊 Excel (.xls) 已导出 — ' + cols + '×' + rows + ' 格，36pt 方正方格');
}

// ============================================================
//  SheetJS .xlsx export — two sheets: 战斗地图(带颜色) + 图例
// ============================================================
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// 字体样式键（含字号）：bold + size + color 三者唯一确定一个 OOXML font
function fontStyleKey(f) {
  return ((f && f.bold) ? 'b' : 'n') + ':' + ((f && f.size) || 11) + ':' + ((f && f.color) || '');
}

function exportMultiSheetXLSX(minQ, maxQ, minR, maxR) {
  const cols = maxQ - minQ + 1;
  const rows = maxR - minR + 1;
  // 方正格子：行高 36pt(=48px)，列宽 6.14 字符(=48px) — 由 writeWorkbookWithShapes 注入
  const ROW_HPT = 36;

  // --- Sheet 1: 战斗地图 ---
  const mapData = [];
  const headerRow = [''];
  for (let c = 0; c < cols; c++) headerRow.push(colLetter(minQ + c));
  mapData.push(headerRow);

  // 先收集每格信息再构建（便于统一计算样式）
  const cellInfos = [];  // [{bg, icon, label, walls}]
  for (let ri = 0; ri < rows; ri++) {
    const r = minR + ri;
    const row = [String(r)];
    const infoRow = [null];
    for (let ci = 0; ci < cols; ci++) {
      const q = minQ + ci;
      const h = getCell(q, r);
      const ti = h.terrain ? getTerrain(h.terrain) : null;
      let val = ti ? ti.icon : '';
      if (h.label) val += (val ? '\n' : '') + '[' + h.label + ']';
      const w = h.walls || [0,0,0,0];
      const tags = [];
      if (w[0] === 1) tags.push('⬆墙'); else if (w[0] === 2) tags.push('⬆门');
      if (w[1] === 1) tags.push('➡墙'); else if (w[1] === 2) tags.push('➡门');
      if (w[2] === 1) tags.push('⬇墙'); else if (w[2] === 2) tags.push('⬇门');
      if (w[3] === 1) tags.push('⬅墙'); else if (w[3] === 2) tags.push('⬅门');
      if (tags.length) val += (val ? '\n' : '') + tags.join(' ');
      if (!val) val = '';
      row.push(val);
      infoRow.push({ bg: ti ? 'FF' + ti.color.replace('#','').toUpperCase() : 'FFFFFFFF', label: h.label || '', walls: w });
    }
    mapData.push(row);
    cellInfos.push(infoRow);
  }

  const wsMap = XLSX.utils.aoa_to_sheet(mapData);

  // 样式键矩阵（与 sheet 单元格对应，含 header 行列）
  //   fill: 'FFxxxxxx'；borders: {t,r,b,l} 0=网格细线 1=墙 2=门；font: {bold,color,size} | null；align: 水平/垂直居中
  const CONTENT_SIZE = 16; // 单元格 emoji/标签字号（默认 11 太小，适度放大便于辨识，已由图例说明地形）
  const styleKeys = [];
  const hdrKey = { fill: 'FF1A1A2E', borders: null, font: { bold: true, color: 'FFAAAAAA', size: 11 }, align: true };
  styleKeys.push(new Array(cols + 1).fill(hdrKey));
  for (let ri = 0; ri < rows; ri++) {
    const rowKeys = [hdrKey];
    for (let ci = 0; ci < cols; ci++) {
      const info = cellInfos[ri][ci + 1];
      const w = info.walls;
      const borders = {
        t: w[0] === 1 ? 1 : (w[0] === 2 ? 2 : 0),
        r: w[1] === 1 ? 1 : (w[1] === 2 ? 2 : 0),
        b: w[2] === 1 ? 1 : (w[2] === 2 ? 2 : 0),
        l: w[3] === 1 ? 1 : (w[3] === 2 ? 2 : 0)
      };
      const hasDoor = w.some(x => x === 2);
      const font = info.label ? { bold: true, color: 'FFFFD700', size: CONTENT_SIZE }
        : (hasDoor ? { bold: true, color: 'FF5A3A15', size: CONTENT_SIZE }
        : { bold: false, size: CONTENT_SIZE });
      rowKeys.push({ fill: info.bg, borders, font, align: true });
    }
    styleKeys.push(rowKeys);
  }

  wsMap['!cols'] = [{ wch: 4.5 }];
  for (let c = 0; c < cols; c++) wsMap['!cols'].push({ wch: 6.14 });
  wsMap['!rows'] = [{ hpt: Math.round(ROW_HPT * 0.6) }];
  for (let ri = 0; ri < rows; ri++) wsMap['!rows'].push({ hpt: ROW_HPT });
  wsMap['!freeze'] = { xSplit: 1, ySplit: 1 };

  // --- Sheet 2: 图例 ---
  const legendData = [['图标', '颜色代码', '名称', '说明']];
  getTerrainList().forEach(id => {
    const t = getTerrain(id);
    legendData.push([t.icon, t.color, t.name, t.desc]);
  });
  legendData.push([]);
  legendData.push(['边界图例']);
  legendData.push(['⬆⬇⬅➡墙', '粗黑边框', '墙壁 — 不可通行']);
  legendData.push(['⬆⬇⬅➡门', '深棕粗虚线', '门 — 可开关']);
  legendData.push([]);
  legendData.push(['提示：区域/图片/线段等图形会作为可拖动对象叠加在"战斗地图"表上']);

  const wsLegend = XLSX.utils.aoa_to_sheet(legendData);
  wsLegend['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMap, '战斗地图');
  XLSX.utils.book_append_sheet(wb, wsLegend, '图例');

  // 写入 xlsx（JSZip 注入：颜色样式 + 方正列宽 + 图形层）
  return writeWorkbookWithShapes(wb, minQ, maxQ, minR, maxR, styleKeys, cols, rows);
}

// ============================================================
//  xlsx 样式注入（JSZip 直接写 OOXML styles.xml）
//  SheetJS 社区版写入不支持 fill/font/border，故手工构建：
//  fills/borders/fonts/cellXfs 全部自定义生成，单元格注入 s="N"
// ============================================================
function buildStyleSheet(styleKeys) {
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const fillMap = new Map([['none', 0], ['gray125', 1]]);
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const borderMap = new Map([['empty', 0]]);
  const fonts = ['<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>'];
  const fontMap = new Map([['normal', 0]]);
  const cellXfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const cellXfsIndex = {};

  const getFill = (rgb) => {
    if (!fillMap.has(rgb)) {
      fillMap.set(rgb, fills.length);
      fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`);
    }
    return fillMap.get(rgb);
  };
  // states: [left,right,top,bottom] 0=网格细线 1=墙 2=门
  const getBorder = (key, states) => {
    if (!borderMap.has(key)) {
      borderMap.set(key, borders.length);
      let xml = '<border>';
      ['left','right','top','bottom'].forEach((side, i) => {
        const st = states[i];
        if (st === 1) xml += `<${side} style="medium"><color rgb="FF000000"/></${side}>`;
        else if (st === 2) xml += `<${side} style="medium"><color rgb="FF5A3A15"/></${side}>`;
        else xml += `<${side} style="hair"><color rgb="FFB0B0B0"/></${side}>`;
      });
      xml += '<diagonal/></border>';
      borders.push(xml);
    }
    return borderMap.get(key);
  };
  const getFont = (bold, color, size) => {
    const key = fontStyleKey({ bold, color, size });
    if (!fontMap.has(key)) {
      fontMap.set(key, fonts.length);
      let xml = `<font><sz val="${size || 11}"/>`;
      if (color) xml += `<color rgb="${color}"/>`;
      if (bold) xml += '<b/>';
      xml += '<name val="Calibri"/><family val="2"/></font>';
      fonts.push(xml);
    }
    return fontMap.get(key);
  };

  for (const row of styleKeys) {
    for (const k of row) {
      const f = getFill(k.fill || 'FFFFFFFF');
      const b = k.borders ? getBorder(`${k.borders.t}${k.borders.r}${k.borders.b}${k.borders.l}`, [k.borders.l, k.borders.r, k.borders.t, k.borders.b]) : 0;
      const ft = k.font ? getFont(k.font.bold, k.font.color, k.font.size) : 0;
      const align = k.align ? 1 : 0;
      const key = `${f}|${b}|${ft}|${align}`;
      if (cellXfsIndex[key] === undefined) {
        cellXfsIndex[key] = cellXfs.length;
        let xf = `<xf numFmtId="0" fontId="${ft}" fillId="${f}" borderId="${b}" xfId="0"`;
        if (ft) xf += ' applyFont="1"';
        if (f) xf += ' applyFill="1"';
        if (b) xf += ' applyBorder="1"';
        if (align) xf += ' applyAlignment="1"';
        xf += '>';
        if (align) xf += '<alignment horizontal="center" vertical="center"/>';
        xf += '</xf>';
        cellXfs.push(xf);
      }
    }
  }

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="${borders.length}">${borders.join('')}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleMedium4"/>` +
    `</styleSheet>`;

  return { stylesXml, cellXfsIndex, fillMap, borderMap, fontMap };
}

function injectCellStyles(sheetXml, styleKeys, styleInfo) {
  const { cellXfsIndex, fillMap, borderMap, fontMap } = styleInfo;
  return sheetXml.replace(/<c r="([A-Z]+)(\d+)"([^>]*)>/g, (m, col, row, rest) => {
    let rI = parseInt(row, 10) - 1;
    let cI = 0;
    for (let i = 0; i < col.length; i++) cI = cI * 26 + (col.charCodeAt(i) - 64);
    cI -= 1;
    if (rI >= 0 && rI < styleKeys.length && cI >= 0 && cI < styleKeys[rI].length) {
      const k = styleKeys[rI][cI];
      const f = fillMap.get(k.fill || 'FFFFFFFF');
      const b = k.borders ? borderMap.get(`${k.borders.t}${k.borders.r}${k.borders.b}${k.borders.l}`) : 0;
      const ft = k.font ? fontMap.get(fontStyleKey(k.font)) : 0;
      const align = k.align ? 1 : 0;
      const idx = cellXfsIndex[`${f}|${b}|${ft}|${align}`];
      if (idx !== undefined) return `<c r="${col}${row}" s="${idx}"${rest}>`;
    }
    return m;
  });
}

function buildColsXml(cols) {
  // 列宽 6.14 字符 = 48px（Excel 换算：px = width*7+5），行高 36pt=48px → 方正
  let xml = '<cols><col min="1" max="1" width="4.5" customWidth="1"/>';
  for (let c = 0; c < cols; c++) xml += `<col min="${c + 2}" max="${c + 2}" width="6.14" customWidth="1"/>`;
  return xml + '</cols>';
}

// ============================================================
//  xlsx 写入总入口 — JSZip 注入：颜色样式 + 方正列宽 + 可拖动图形
// ============================================================
function dataURLToArrayBuffer(dataURL) {
  const base64 = dataURL.split(',')[1];
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function writeWorkbookWithShapes(wb, minQ, maxQ, minR, maxR, styleKeys, cols, rows) {
  const filename = 'combatmap_' + new Date().toISOString().slice(0,10) + '.xlsx';
  const hasGraphics = shapes.length > 0 || freeLines.length > 0 || tokens.length > 0;

  if (typeof JSZip === 'undefined') {
    XLSX.writeFile(wb, filename);
    showToast('⚠️ 样式组件(JSZip)未加载（需联网），xlsx 无颜色；请联网后重新导出');
    return;
  }

  try {
    // 1. SheetJS 生成基础 xlsx（无样式，样式由我们注入）
    const out = XLSX.write(wb, { type: 'array' });
    const zip = await JSZip.loadAsync(out);

    // 2. 注入 styles.xml（颜色/边框/字体）
    const styleInfo = buildStyleSheet(styleKeys);
    zip.file('xl/styles.xml', styleInfo.stylesXml);

    // 3. sheet1.xml：注入单元格 s 样式引用 + 方正列宽
    let sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    sheetXml = injectCellStyles(sheetXml, styleKeys, styleInfo);
    sheetXml = sheetXml.replace(/<cols>[\s\S]*?<\/cols>/, buildColsXml(cols));
    zip.file('xl/worksheets/sheet1.xml', sheetXml);

    // 4. drawing 注入（图形层 → Excel 可拖动对象）
    if (hasGraphics) {
      const EMU_CELL = 457200;   // 列宽 48px @96dpi
      const EMU_ROW = 457200;    // 行高 36pt = 0.5in
      const X_NS = 'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
      const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
      const anchors = [];
      let idCounter = 2;
      let imgCounter = 0;
      const mediaFiles = [];   // { name, data }

      const absToAnchor = (absX, absY) => {
        const col = Math.floor(absX / EMU_CELL);
        const row = Math.floor(absY / EMU_ROW);
        return { col, colOff: Math.round(absX - col * EMU_CELL), row, rowOff: Math.round(absY - row * EMU_ROW) };
      };
      const shapeToAbs = (gx, gy, gw, gh) => ({
        x0: (1 + gx - minQ) * EMU_CELL,
        y0: (1 + gy - minR) * EMU_ROW,
        x1: (1 + gx + gw - minQ) * EMU_CELL,
        y1: (1 + gy + gh - minR) * EMU_ROW
      });

      for (const sh of shapes) {
        const a = shapeToAbs(sh.x, sh.y, sh.w, sh.h);
        const from = absToAnchor(a.x0, a.y0);
        const to = absToAnchor(a.x1, a.y1);
        const fromXml = `<xdr:from><xdr:col>${from.col}</xdr:col><xdr:colOff>${from.colOff}</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>${from.rowOff}</xdr:rowOff></xdr:from>`;
        const toXml = `<xdr:to><xdr:col>${to.col}</xdr:col><xdr:colOff>${to.colOff}</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>${to.rowOff}</xdr:rowOff></xdr:to>`;

        if (sh.type === 'rect') {
          const fillHex = (sh.fill || '#e94560').replace('#','').toUpperCase();
          const strokeHex = (sh.stroke || '#ffffff').replace('#','').toUpperCase();
          const alpha = Math.round(Math.max(0, Math.min(1, sh.fillAlpha ?? 0.4)) * 100000);
          const lnW = Math.round((sh.strokeWidth || 0) * 9525);
          const dashXml = sh.dash ? '<a:prstDash val="dash"/>' : '';
          anchors.push(
            `<xdr:twoCellAnchor editAs="absolute">${fromXml}${toXml}` +
            `<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="${idCounter++}" name="区域 ${idCounter-2}"/><xdr:cNvSpPr/></xdr:nvSpPr>` +
            `<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
            `<a:solidFill><a:srgbClr val="${fillHex}"><a:alpha val="${alpha}"/></a:srgbClr></a:solidFill>` +
            (lnW > 0 ? `<a:ln w="${lnW}"><a:solidFill><a:srgbClr val="${strokeHex}"/></a:solidFill>${dashXml}</a:ln>` : '') +
            `</xdr:spPr></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`
          );
        } else if (sh.type === 'image' && sh.imgData) {
          imgCounter++;
          const mediaName = 'image' + imgCounter + '.png';
          mediaFiles.push({ name: mediaName, data: dataURLToArrayBuffer(sh.imgData) });
          anchors.push(
            `<xdr:twoCellAnchor editAs="absolute">${fromXml}${toXml}` +
            `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${idCounter++}" name="图片 ${idCounter-2}"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
            `<xdr:blipFill><a:blip ${R_NS} r:embed="rId${imgCounter}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
            `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
            `</xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`
          );
        }
      }

      for (const ln of freeLines) {
        const a0 = shapeToAbs(ln.x1, ln.y1, 0, 0);
        const a1 = shapeToAbs(ln.x2, ln.y2, 0, 0);
        const from = absToAnchor(a0.x0, a0.y0);
        const to = absToAnchor(a1.x1, a1.y1);
        const colorHex = (ln.color || '#000000').replace('#','').toUpperCase();
        const lnW = Math.round((ln.width || 3) * 9525);
        const dashXml = ln.dash ? '<a:prstDash val="dash"/>' : '';
        anchors.push(
          `<xdr:twoCellAnchor editAs="absolute">` +
          `<xdr:from><xdr:col>${from.col}</xdr:col><xdr:colOff>${from.colOff}</xdr:colOff><xdr:row>${from.row}</xdr:row><xdr:rowOff>${from.rowOff}</xdr:rowOff></xdr:from>` +
          `<xdr:to><xdr:col>${to.col}</xdr:col><xdr:colOff>${to.colOff}</xdr:colOff><xdr:row>${to.row}</xdr:row><xdr:rowOff>${to.rowOff}</xdr:rowOff></xdr:to>` +
          `<xdr:cxnSp><xdr:nvCxnSpPr><xdr:cNvPr id="${idCounter++}" name="线段 ${idCounter-2}"/><xdr:cNvCxnSpPr><a:stCxn/><a:endCxn/></xdr:cNvCxnSpPr></xdr:nvCxnSpPr>` +
          `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom>` +
          `<a:ln w="${lnW}"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill>${dashXml}</a:ln></xdr:spPr></xdr:cxnSp>` +
          `<xdr:clientData/></xdr:twoCellAnchor>`
        );
      }

      const drawingXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
        `<xdr:wsDr ${X_NS} ${R_NS}>` + anchors.join('') + `</xdr:wsDr>`;

      zip.file('xl/drawings/drawing1.xml', drawingXml);
      let relXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
      mediaFiles.forEach((m, i) => {
        zip.file('xl/media/' + m.name, m.data);
        relXml += `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${m.name}"/>`;
      });
      relXml += `</Relationships>`;
      zip.file('xl/drawings/_rels/drawing1.xml.rels', relXml);

      const drawingRef = `<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId100"/>`;
      if (sheetXml.includes('<sheetData/>')) {
        sheetXml = sheetXml.replace('<sheetData/>', '<sheetData></sheetData>' + drawingRef);
      } else if (sheetXml.includes('</sheetData>')) {
        sheetXml = sheetXml.replace('</sheetData>', '</sheetData>' + drawingRef);
      } else {
        sheetXml = sheetXml.replace('</worksheet>', drawingRef + '</worksheet>');
      }
      zip.file('xl/worksheets/sheet1.xml', sheetXml);

      const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
      let sheetRels = '';
      if (zip.file(relsPath)) {
        sheetRels = await zip.file(relsPath).async('string');
        sheetRels = sheetRels.replace('</Relationships>',
          `<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
      } else {
        sheetRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId100" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
      }
      zip.file(relsPath, sheetRels);

      let typesXml = await zip.file('[Content_Types].xml').async('string');
      if (!typesXml.includes('Extension="png"')) {
        typesXml = typesXml.replace('</Types>', `<Default Extension="png" ContentType="image/png"/></Types>`);
      }
      typesXml = typesXml.replace('</Types>',
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
      zip.file('[Content_Types].xml', typesXml);
    }

    // 5. 打包下载
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, filename);
    const gfxNote = hasGraphics ? ` + ${shapes.length} 图形/${freeLines.length} 线段/${tokens.length} 单位(可拖动)` : '';
    showToast(`📊 xlsx 已导出（颜色+方正格子${gfxNote}）`);
  } catch (err) {
    console.error(err);
    XLSX.writeFile(wb, filename);
    showToast('⚠️ xlsx 样式注入失败，已导出基础 xlsx（无颜色）：' + (err?.message || '未知错误'));
  }
}

function colLetter(n) {
  let s = '';
  n++;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
//  Export: PNG
// ============================================================
function renderMapCanvas(exact) {
  cleanData();
  const keys = Object.keys(combatData);
  const hasGraphics = shapes.length > 0 || freeLines.length > 0 || tokens.length > 0;
  if (keys.length === 0 && !hasGraphics) return null;

  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  const feed = (q, r) => {
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  };
  keys.forEach(k => {
    const [q, r] = k.split(',').map(Number);
    feed(q, r);
  });
  shapes.forEach(sh => {
    feed(Math.floor(sh.x), Math.floor(sh.y));
    feed(Math.ceil(sh.x + sh.w), Math.ceil(sh.y + sh.h));
  });
  freeLines.forEach(ln => {
    feed(Math.floor(Math.min(ln.x1, ln.x2)), Math.floor(Math.min(ln.y1, ln.y2)));
    feed(Math.ceil(Math.max(ln.x1, ln.x2)), Math.ceil(Math.max(ln.y1, ln.y2)));
  });
  tokens.forEach(t => {
    feed(Math.floor(t.x), Math.floor(t.y));
    feed(Math.ceil(t.x + t.w), Math.ceil(t.y + t.h));
  });
  if (!isFinite(minQ)) { minQ = -2; maxQ = 2; minR = -2; maxR = 2; }

  // 导出范围包含底图区域
  if (backgroundMap) {
    feed(Math.floor(backgroundMap.x), Math.floor(backgroundMap.y));
    feed(Math.ceil(backgroundMap.x + backgroundMap.cols), Math.ceil(backgroundMap.y + backgroundMap.rows));
  }

  const half = CELL_SIZE / 2;
  const padding = CELL_SIZE * 2;
  const topLeftX = minQ * CELL_SIZE - half;
  const topLeftY = minR * CELL_SIZE - half;
  // 导出范围包含被战雾覆盖的格子，避免只导出已揭示区域导致边界缺失
  Object.keys(fog).forEach(k => {
    const [q, r] = k.split(',').map(Number);
    feed(q, r);
  });
  const w = Math.ceil((maxQ - minQ + 1) * CELL_SIZE + padding * 2);
  const h = Math.ceil((maxR - minR + 1) * CELL_SIZE + padding * 2);
  const MAX_EXPORT = 8000;
  if (w > MAX_EXPORT || h > MAX_EXPORT) { showToast('⚠️ 地图太大，缩小范围后导出'); return; }

  const expCanvas = document.createElement('canvas');
  if (exact) {
    // 精确渲染：地图左上角固定于 (padding, padding)，用于枭熊网格对齐
    expCanvas.width = Math.max(w, 1);
    expCanvas.height = Math.max(h, 1);
  } else {
    expCanvas.width = Math.max(w, 400);
    expCanvas.height = Math.max(h, 300);
  }
  const expCtx = expCanvas.getContext('2d');
  expCtx.fillStyle = artStyle === 'handdrawn' ? '#1d2117' : '#2d2d44';
  expCtx.fillRect(0, 0, expCanvas.width, expCanvas.height);

  let offsetX, offsetY;
  if (exact) {
    offsetX = padding - topLeftX;
    offsetY = padding - topLeftY;
  } else {
    offsetX = (expCanvas.width - w) / 2 - topLeftX + padding;
    offsetY = (expCanvas.height - h) / 2 - topLeftY + padding;
  }
  expCtx.save();
  expCtx.translate(offsetX, offsetY);

  // Pass 1: fills + grid
  for (const key of keys) {
    const [q, r] = key.split(',').map(Number);
    drawCombatCellBase(expCtx, q, r, combatData[key]);
  }

  // Pass 1.5: 底图（导出包含背景，DM/玩家图均一致）
  if (backgroundMap && backgroundMap.imgData) {
    const bm = backgroundMap;
    expCtx.save();
    expCtx.globalAlpha = Math.max(0, Math.min(1, bm.opacity ?? 0.85));
    if (bm.img && bm.img.complete) {
      expCtx.drawImage(bm.img, bm.x * CELL_SIZE, bm.y * CELL_SIZE, bm.cols * CELL_SIZE, bm.rows * CELL_SIZE);
    }
    expCtx.restore();
  }

  // Pass 2: walls
  for (const key of keys) {
    const [q, r] = key.split(',').map(Number);
    const hCell = combatData[key];
    if (!hCell.walls) continue;
    const p = cellToPixel(q, r);
    for (let edge = 0; edge < 4; edge++) {
      const state = hCell.walls[edge];
      if (state === 0) continue;
      let x1, y1, x2, y2;
      if (edge === 0) { x1 = p.x - half; y1 = p.y - half; x2 = p.x + half; y2 = p.y - half; }
      else if (edge === 1) { x1 = p.x + half; y1 = p.y - half; x2 = p.x + half; y2 = p.y + half; }
      else if (edge === 2) { x1 = p.x - half; y1 = p.y + half; x2 = p.x + half; y2 = p.y + half; }
      else { x1 = p.x - half; y1 = p.y - half; x2 = p.x - half; y2 = p.y + half; }
      if (state === 1) {
        expCtx.strokeStyle = '#1a1a1a'; expCtx.lineWidth = 3.5;
        expCtx.beginPath(); expCtx.moveTo(x1, y1); expCtx.lineTo(x2, y2); expCtx.stroke();
      } else if (state === 2) {
        expCtx.strokeStyle = '#5a3a15'; expCtx.lineWidth = 3.5;
        expCtx.setLineDash([5, 4]);
        expCtx.beginPath(); expCtx.moveTo(x1, y1); expCtx.lineTo(x2, y2); expCtx.stroke();
        expCtx.setLineDash([]);
        // 门图标（醒目）
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        expCtx.font = `${CELL_SIZE * 0.30}px sans-serif`;
        expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
        let ox = 0, oy = 0;
        if (edge === 0) oy = 1;
        else if (edge === 2) oy = -1;
        else if (edge === 1) ox = -1;
        else ox = 1;
        expCtx.fillStyle = '#5a3a15';
        expCtx.fillRect(mx + ox * 2 - 9, my + oy * 2 - 9, 18, 18);
        expCtx.fillStyle = '#fff';
        expCtx.fillText('🚪', mx + ox * 2, my + oy * 2);
      }
    }
  }

  // Pass 3: overlays
  for (const key of keys) {
    const [q, r] = key.split(',').map(Number);
    const hCell = combatData[key];
    const p = cellToPixel(q, r);
    const ti = hCell.terrain ? getTerrain(hCell.terrain) : null;
    if (ti) {
      expCtx.font = `${CELL_SIZE * 0.32}px sans-serif`;
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
      expCtx.fillStyle = isLightColor(ti.color) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)';
      expCtx.fillText(ti.icon, p.x, p.y - (hCell.label ? CELL_SIZE * 0.12 : 0));
    }
    if (hCell.label) {
      expCtx.font = `bold ${Math.max(8, CELL_SIZE * 0.26)}px sans-serif`;
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'bottom';
      const tw = expCtx.measureText(hCell.label).width;
      const lh = CELL_SIZE * 0.30;
      const by = p.y - CELL_SIZE * 0.38;
      expCtx.fillStyle = 'rgba(0,0,0,0.6)';
      expCtx.fillRect(p.x - tw/2 - 3, by, tw + 6, lh);
      expCtx.fillStyle = '#ffd700';
      expCtx.fillText(hCell.label, p.x, by + lh - 1);
    }
  }

  // Pass 4: 自由线段（合成）
  for (const ln of freeLines) {
    const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
    expCtx.strokeStyle = ln.color || '#000';
    expCtx.lineWidth = ln.width || 3;
    expCtx.setLineDash(ln.dash ? [8, 5] : []);
    expCtx.beginPath(); expCtx.moveTo(p1.x, p1.y); expCtx.lineTo(p2.x, p2.y); expCtx.stroke();
    expCtx.setLineDash([]);
  }

  // Pass 5: 图形图层（合成）
  for (const sh of shapes) {
    const p = cellToPixel(sh.x, sh.y);
    const w = sh.w * CELL_SIZE, h = sh.h * CELL_SIZE;
    if (sh.type === 'rect') {
      expCtx.globalAlpha = Math.max(0, Math.min(1, sh.fillAlpha ?? 0.4));
      expCtx.fillStyle = sh.fill || '#e94560';
      expCtx.fillRect(p.x, p.y, w, h);
      expCtx.globalAlpha = 1;
      if (sh.strokeWidth > 0) {
        expCtx.strokeStyle = sh.stroke || '#fff';
        expCtx.lineWidth = sh.strokeWidth;
        expCtx.setLineDash(sh.dash ? [6, 4] : []);
        expCtx.strokeRect(p.x, p.y, w, h);
        expCtx.setLineDash([]);
      }
    } else if (sh.type === 'image' && sh.img) {
      expCtx.save();
      expCtx.beginPath();
      expCtx.rect(p.x, p.y, w, h);
      expCtx.clip();
      expCtx.drawImage(sh.img, p.x, p.y, w, h);
      expCtx.restore();
    }
    if (sh.name) {
      expCtx.fillStyle = 'rgba(0,0,0,0.65)';
      expCtx.font = `bold 13px sans-serif`;
      const tw = expCtx.measureText(sh.name).width;
      const ty = Math.max(2, p.y - 4);
      expCtx.fillRect(p.x, ty - 12, tw + 6, 14);
      expCtx.fillStyle = '#ffd700';
      expCtx.textAlign = 'left'; expCtx.textBaseline = 'middle';
      expCtx.fillText(sh.name, p.x + 3, ty - 5);
    }
  }

  // Pass 6: 单位层（合成）
  for (const t of tokens) {
    const p = cellToPixel(t.x, t.y);
    const w = t.w * CELL_SIZE, h = t.h * CELL_SIZE;
    expCtx.beginPath();
    expCtx.ellipse(p.x + w / 2, p.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    expCtx.fillStyle = t.color || '#3a7abd';
    expCtx.fill();
    expCtx.lineWidth = 2;
    expCtx.strokeStyle = 'rgba(255,255,255,0.85)';
    expCtx.stroke();
    if (t.imgData && t.img) {
      expCtx.save();
      expCtx.beginPath();
      expCtx.ellipse(p.x + w / 2, p.y + h / 2, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
      expCtx.clip();
      expCtx.drawImage(t.img, p.x + 3, p.y + 3, w - 6, h - 6);
      expCtx.restore();
    } else if (t.icon) {
      expCtx.font = `${Math.min(w, h) * 0.55}px sans-serif`;
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
      expCtx.fillText(t.icon, p.x + w / 2, p.y + h / 2);
    }
    if (t.name) {
      expCtx.font = `bold 11px sans-serif`;
      const tw = expCtx.measureText(t.name).width + 8;
      const by = Math.max(2, p.y - 10);
      expCtx.fillStyle = 'rgba(0,0,0,0.7)';
      expCtx.fillRect(p.x + w / 2 - tw / 2, by, tw, 14);
      expCtx.fillStyle = '#fff';
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
      expCtx.fillText(t.name, p.x + w / 2, by + 7);
    }
    if (typeof t.maxHp === 'number' && t.maxHp > 0) {
      const hp = Math.max(0, Math.min(t.maxHp, t.hp ?? t.maxHp));
      const barW = Math.max(w * 0.8, 20);
      const bx = p.x + w / 2 - barW / 2;
      const by = p.y + h - 2;
      const temp = Math.max(0, t.tempHp || 0);
      if (temp > 0) {
        const tempH = 3;
        expCtx.fillStyle = 'rgba(0,0,0,0.7)';
        expCtx.fillRect(bx - 1, by - tempH - 1, barW + 2, tempH + 2);
        expCtx.fillStyle = '#4af';
        expCtx.fillRect(bx, by - tempH - 1, barW * Math.min(1, temp / Math.max(1, t.maxHp)), tempH);
      }
      expCtx.fillStyle = 'rgba(0,0,0,0.7)';
      expCtx.fillRect(bx - 1, by - 1, barW + 2, 6);
      expCtx.fillStyle = '#a33';
      expCtx.fillRect(bx, by, barW, 4);
      expCtx.fillStyle = hp / t.maxHp > 0.5 ? '#3c3' : (hp / t.maxHp > 0.25 ? '#cc3' : '#e33');
      expCtx.fillRect(bx, by, barW * hp / t.maxHp, 4);
    }
    // AC 角标（导出与画布一致）
    if (t.ac !== undefined && t.ac !== null && String(t.ac).trim() !== '') {
      expCtx.font = "bold 10px sans-serif";
      const txt = 'AC ' + String(t.ac).trim();
      const tw3 = expCtx.measureText(txt).width + 8;
      expCtx.fillStyle = 'rgba(10,10,20,0.78)';
      expCtx.fillRect(p.x + w - tw3 - 2, p.y + h - 15, tw3, 13);
      expCtx.fillStyle = '#ffd700';
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
      expCtx.fillText(txt, p.x + w - tw3 / 2 - 2, p.y + h - 8.5);
    }
    // 速度角标（导出与画布一致）
    if (t.speed !== undefined && t.speed !== null && String(t.speed).trim() !== '') {
      const spTxt = String(t.speed).trim();
      expCtx.font = "bold 10px sans-serif";
      const twS = expCtx.measureText(spTxt).width + 8;
      expCtx.fillStyle = 'rgba(10,10,20,0.78)';
      expCtx.fillRect(p.x + 2, p.y + h - 15, twS, 13);
      expCtx.fillStyle = '#8cf';
      expCtx.textAlign = 'center'; expCtx.textBaseline = 'middle';
      expCtx.fillText(spTxt, p.x + 2 + twS / 2, p.y + h - 8.5);
    }
  }

  // Pass 7: 战雾遮罩（导出玩家可见图时保留；DM 层不导出）
  if (showFogLayer) {
    const hasVision = tokens.some(t => t.visionSource && (t.sightRadius || 0) > 0);
    const autoMask = visionMode === 'auto' && viewRoleIsPlayer() && hasVision;
    const vis = autoMask ? computeVisibleCells() : null;
    // 输出范围内逐格绘制雾
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        if (autoMask) {
          if (vis.has(cellKey(q, r))) continue; // 玩家可见，不遮
        } else {
          if (!isFogCell(q, r)) continue;
        }
        expCtx.fillStyle = 'rgba(12, 12, 20, 0.82)';
        expCtx.fillRect(q * CELL_SIZE - CELL_SIZE / 2, r * CELL_SIZE - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  expCtx.restore();
  return { canvas: expCanvas, minQ, maxQ, minR, maxR, keys };
}

function exportPNG() {
  const result = renderMapCanvas();
  if (!result) {
    showToast('⚠️ 没有数据可导出');
    return;
  }
  const link = document.createElement('a');
  link.download = `combatmap_${new Date().toISOString().slice(0,10)}.png`;
  link.href = result.canvas.toDataURL('image/png');
  link.click();
  showToast(`🖼️ PNG 已导出 ${result.canvas.width}×${result.canvas.height}`);
}

// ============================================================
//  Export: Legend PNG（图例快照，DM 用）
// ============================================================
function exportLegendPNG() {
  const list = getTerrainList();
  const CELL = 30, PAD = 10, LINE_H = 34;
  const cw = 300, ch = PAD * 2 + list.length * LINE_H + 40;
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const c = canvas.getContext('2d');
  c.fillStyle = '#16213e';
  c.fillRect(0, 0, cw, ch);
  c.fillStyle = '#e94560';
  c.font = 'bold 16px sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText('⚔️ 战斗地图图例', PAD, 20);
  c.font = '12px sans-serif';
  c.fillStyle = '#aaa';
  c.fillText(`共 ${list.length} 种地形 · 通用战斗地图 ${COMBATMAP_VERSION}`, PAD, 38);
  list.forEach((id, i) => {
    const t = getTerrain(id);
    const y = PAD + 40 + i * LINE_H;
    c.fillStyle = t.color;
    c.fillRect(PAD, y, CELL, CELL);
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 1;
    c.strokeRect(PAD, y, CELL, CELL);
    c.fillStyle = '#fff';
    c.font = '13px sans-serif';
    c.textAlign = 'left';
    c.fillText(`${t.icon} ${t.name}`, PAD + CELL + 10, y + CELL / 2);
    c.fillStyle = '#888';
    c.font = '11px sans-serif';
    const desc = t.desc || '';
    c.fillText(desc, PAD + CELL + 150, y + CELL / 2);
  });
  const link = document.createElement('a');
  link.download = `combatmap_legend_${new Date().toISOString().slice(0,10)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast(`📜 图例已导出（${list.length} 种地形）`);
}

// ============================================================
//  Export: Owlbear Rodeo 场景（.owlbear，可在枭熊中导入）
//  含地图 PNG + 单位 token 图片（尽量合成进地图图；当前 token 已随 PNG 合成）
// ============================================================
function exportOwlbearScene() {
  const result = renderMapCanvas(true);
  if (!result) {
    showToast('⚠️ 没有数据可导出');
    return;
  }
  const { canvas, minQ, maxQ, minR, maxR } = result;
  const cols = maxQ - minQ + 1, rows = maxR - minR + 1;
  const padding = CELL_SIZE * 2;  // 与 renderMapCanvas 一致
  const pngDataURL = canvas.toDataURL('image/png');
  const assetId = 'asset_map_' + Date.now().toString(36);
  const mapId = 'map_' + Date.now().toString(36);

  const scene = {
    data: {
      data: [
        {
          tableName: 'maps',
          rows: [{
            id: mapId,
            name: '通用战斗地图 ' + new Date().toISOString().slice(0,10),
            file: assetId,
            grid: {
              type: 'SQUARE',
              size: CELL_SIZE,
              color: '#000000',
              offset: { x: padding, y: padding }
            }
          }]
        },
        {
          tableName: 'assets',
          rows: [{
            id: assetId,
            mime: 'image/png',
            file: { buffer: pngDataURL.split(',')[1] }
          }]
        }
      ]
    }
  };

  const blob = new Blob([JSON.stringify(scene)], { type: 'application/json' });
  downloadBlob(blob, `combatmap_${new Date().toISOString().slice(0,10)}.owlbear`);
  showToast(`🦉 枭熊场景已导出（${cols}×${rows} 格，48px 网格）— 在枭熊中导入场景即可继续`);
}

// ============================================================
//  Save / Load JSON
// ============================================================
function saveJSON() {
  cleanData();
  cleanMetaRefs();
  const data = {
    combatData,
    dmData,
    fog,
    backgroundMap: backgroundMap ? { ...backgroundMap, img: undefined } : null,
    initiativeOrder,
    initiativeIndex,
    shapes: shapes.map(s => { const c = { ...s }; delete c.img; return c; }),
    freeLines,
    tokens: tokens.map(t => { const c = { ...t }; delete c.img; return c; }),
    groups,
    customUnitStatuses,
    tokenPresets: (typeof tokenPresets !== 'undefined') ? tokenPresets : [],
    viewX, viewY, zoom
  };
  // 多场景：把整个战役（场景列表 + 当前激活）一并保存
  const campaign = {
    scenes: (typeof scenes !== 'undefined') ? scenes.map(s => ({ id: s.id, name: s.name, data: cloneSceneData(s.data) })) : undefined,
    activeSceneId: (typeof activeSceneId !== 'undefined') ? activeSceneId : undefined
  };
  const json = JSON.stringify({ ...data, ...campaign });
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `combatmap_${new Date().toISOString().slice(0,10)}.json`);
  showToast(`💾 已保存 — ${Object.keys(combatData).length} 格 / ${shapes.length} 图形 / ${freeLines.length} 线段 / ${tokens.length} 单位`);
}

function loadJSON() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // 多场景战役文件：恢复场景列表 + 激活场景，再载入当前激活场景
        if (data && Array.isArray(data.scenes) && data.scenes.length) {
          if (typeof scenes !== 'undefined') {
            scenes = data.scenes.map(s => ({ id: s.id || (typeof nextSceneId === 'function' ? nextSceneId() : 'sc'), name: s.name || '场景', data: s.data || {} }));
            activeSceneId = data.activeSceneId || scenes[0].id;
            if (!sceneById(activeSceneId)) activeSceneId = scenes[0].id;
            applyCombatData(sceneById(activeSceneId).data);
            if (typeof renderSceneList === 'function') renderSceneList();
            showToast(`📂 已加载战役 — ${scenes.length} 个场景`);
            return;
          }
        }
        // 单场景（旧格式 / 直接分享导入）：载入当前地图并包成 1 个场景
        if (data && data.combatData !== undefined && data.tokens !== undefined) {
          const n = applyCombatData(data);
          if (typeof ensureScenes === 'function') ensureScenes();
          if (typeof renderSceneList === 'function') renderSceneList();
          showToast(`📂 已加载 — ${n} 格 / ${shapes.length} 图形 / ${freeLines.length} 线段 / ${tokens.length} 单位`);
          return;
        }
        showToast('⚠️ 加载失败，文件格式不完整');
      } catch(err) { showToast('⚠️ 加载失败，文件格式错误'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================================
