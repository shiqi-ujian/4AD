"""
从 CoC 7th 规则书 PDF 中提取文本
依赖: pip install pymupdf
"""

import fitz  # pymupdf
import os

PDF_PATH = os.path.join(os.path.dirname(__file__), "1.克苏鲁的呼唤第七版守秘人规则书 40周年纪念版.pdf")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "coc7_rules")

def main():
    if not os.path.exists(PDF_PATH):
        print(f"PDF not found: {PDF_PATH}")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)
    print(f"Total pages: {total_pages}")

    # 每 50 页输出一个文件，避免单文件过大
    CHUNK = 50

    for start in range(0, total_pages, CHUNK):
        end = min(start + CHUNK, total_pages)
        part_num = start // CHUNK + 1
        output_path = os.path.join(OUTPUT_DIR, f"part_{part_num:02d}_p{start+1}-{end}.txt")

        text_parts = []
        for page_num in range(start, end):
            page = doc[page_num]
            text = page.get_text()
            text_parts.append(f"===== 第 {page_num + 1} 页 =====\n{text}")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n\n".join(text_parts))

        print(f"  Written: {output_path}")

    doc.close()
    print(f"\nDone! Extracted to {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()
