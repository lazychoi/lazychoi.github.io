# 용어 사전 및 한글을 한자로 변환하는 앱

## 파일 구성

### 용어 사전

- farm.html
- farm_styles.css
- farm_search.js
- references.html: 참고 도서 목록
- Supabase: 용어 노트 데이터
- /img: 용어 노트 데이터 이미지 파일

### 한글-한자 변환 앱

- hanja.html
- hanja_app.js
- hanja_build.js: 독립 프로그램(실행: node hanja_build.js). data/*.txt 파일을 읽어서 텍스트 파일 목록을 저장하는 data/manifest.json 파일을 생성
- build_dict.js: 독립 프로그램(실행: node build_dict.js). data/*.txt 파일을 읽어서 data/hanja_dict.json 파일을 생성. 생성한 json 파일 용량이 커서 속도에 불리함. 사용하지 않음.
- generate_strokes.py: 한자 획수를 저장한 data/strokes.json 파일을 생성하는 독립 프로그램. 이미 생성이 되어 있으므로 다시 실행할 필요가 없음.
- data/: 한글 한자 사전 데이터

### 영어 자막 파일 만드는 방법(with Audacity)

1. 라벨 트랙 추가하기:Audacity 준비.오디오 파일을 불러온 후, 상단 메뉴에서 **트랙 > 새로 추가 > 라벨 트랙(Tracks > Add New > Label Track)**을 선택한다. 오디오 트랙 아래에 새로운 라벨 트랙이 생성된다.
2. 재생하며 마커 및 가사 삽입:단축키 활용.오디오를 재생하다가 가사가 시작되는 지점에서 단축키 Cmd + B(선택 영역에 라벨 추가)를 누른다. 마커가 생성되면 그 자리에 해당 구절의 가사를 바로 입력한다.
3. 라벨 텍스트로 내보내기:데이터 추출.작업이 끝나면 **파일 > 내보내기 > 라벨 내보내기(File > Export > Export Labels...)**를 선택한다. 파일 형식은 .txt로 저장된다.

### mp3 파일 인코딩 시 주의사항

- VBR은 모바일에서 재생하거나 구간반복할 때 싱크가 맞지 않는 문제 발생 → **CBR(Constant Bit Rate)**로 인코딩한다.
- 오디오북은 Mono, 16000Hz, 96Kbps로 해도 충분하다.