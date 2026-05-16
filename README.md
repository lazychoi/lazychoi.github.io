# 농업 용어 사전 및 한글을 한자로 변환하는 앱

## 파일 구성

### 농업 용어 사전

- farm.html
- farm_styles.css
- farm_search.js
- references.html: 참고 도서 목록
- data.csv: 농업 용어 사전 데이터
- /img: 농업 용어 사전 데이터 이미지 파일

### 한글-한자 변환 앱

- hanja.html
- hanja_app.js
- hanja_build.js: 독립 프로그램(실행: node hanja_build.js). data/*.txt 파일을 읽어서 텍스트 파일 목록을 저장하는 data/manifest.json 파일을 생성
- build_dict.js: 독립 프로그램(실행: node build_dict.js). data/*.txt 파일을 읽어서 data/hanja_dict.json 파일을 생성. 생성한 json 파일 용량이 커서 속도에 불리함. 사용하지 않음.
- generate_strokes.py: 한자 획수를 저장한 data/strokes.json 파일을 생성하는 독립 프로그램. 이미 생성이 되어 있으므로 다시 실행할 필요가 없음.
- data/: 한글 한자 사전 데이터

