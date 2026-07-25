import pdfplumber
import re
import os

pdf_path = "data/용어-해부학anatomy.pdf"
output_path = "anatomy.txt"

def group_words_into_lines(words, tolerance=3.0):
    lines = []
    # top 좌표 기준으로 정렬
    sorted_words = sorted(words, key=lambda w: w['top'])
    
    current_line = []
    current_top = None
    
    for w in sorted_words:
        if current_top is None:
            current_top = w['top']
            current_line.append(w)
        elif abs(w['top'] - current_top) <= tolerance:
            current_line.append(w)
        else:
            lines.append(current_line)
            current_line = [w]
            current_top = w['top']
            
    if current_line:
        lines.append(current_line)
        
    return lines

print("Starting term extraction from PDF...")

all_terms = []

with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    print(f"Total pages to process: {total_pages - 2} (Pages 3 to {total_pages})")
    
    # 3페이지(index 2)부터 마지막 페이지까지 처리
    for page_idx in range(2, total_pages):
        page = pdf.pages[page_idx]
        words = page.extract_words()
        
        # 1. 페이지 헤더(top < 50) 및 주석(height < 7.0) 1차 필터링
        filtered_words = [
            w for w in words 
            if w['top'] >= 50 and w['height'] >= 7.0
        ]
        
        # 2. 각 단어의 특수 제어문자(\x08 등) 처리 및 공백 치환
        for w in filtered_words:
            # \x08 제어문자를 공백으로 치환
            w['text'] = w['text'].replace('\x08', ' ')
            # 제어문자 제거 (\x00-\x1f, \x7f-\x9f)
            w['text'] = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", w['text'])
            # 연속된 공백 정리
            w['text'] = re.sub(r"\s+", " ", w['text']).strip()
            
        # 3. 행별 그룹화
        lines = group_words_into_lines(filtered_words)
        
        raw_lines = []
        for line in lines:
            line = sorted(line, key=lambda w: w['x0'])
            
            # 컬럼 구분 (x0 < 140: 한글, 140 <= x0 < 290: 영어)
            col1 = [w['text'] for w in line if w['x0'] < 140]
            col2 = [w['text'] for w in line if 140 <= w['x0'] < 290]
            
            col1_txt = " ".join(col1).strip()
            col2_txt = " ".join(col2).strip()
            
            # 공백 정리
            col1_txt = re.sub(r"\s+", " ", col1_txt)
            col2_txt = re.sub(r"\s+", " ", col2_txt)
            
            if not col1_txt and not col2_txt:
                continue
                
            raw_lines.append((col1_txt, col2_txt))
            
        # 4. 영어 여러 줄 래핑 병합
        merged_lines = []
        for col1_txt, col2_txt in raw_lines:
            if merged_lines:
                prev_ko, prev_en = merged_lines[-1]
                # 한글은 비어있고 영어만 있는 경우 -> 이전 영어에 병합
                if not col1_txt and col2_txt:
                    merged_lines[-1] = (prev_ko, f"{prev_en} {col2_txt}".strip())
                    continue
            merged_lines.append((col1_txt, col2_txt))
            
        # 5. 정제 및 결과 리스트 추가
        for ko, en in merged_lines:
            # 한글 끝에 붙은 주석 숫자 제거
            ko_clean = re.sub(r"\d+$", "", ko).strip()
            
            # 둘 다 비어있거나, 한글이 없는데 영어만 남은 비정상적인 행은 패스 (대개 헤더/푸터 잔여물)
            if not ko_clean or not en:
                continue
                
            all_terms.append((ko_clean, en))
            
        if (page_idx + 1) % 20 == 0 or page_idx == total_pages - 1:
            print(f"Processed page {page_idx + 1}/{total_pages}...")

# 파일 쓰기
with open(output_path, "w", encoding="utf-8") as f:
    for ko, en in all_terms:
        # 형식: "한글|영어||영어 발음" (영어 발음은 비워둠)
        f.write(f"{ko}|{en}||\n")

print(f"Extraction completed! Total {len(all_terms)} terms saved to '{output_path}'.")
