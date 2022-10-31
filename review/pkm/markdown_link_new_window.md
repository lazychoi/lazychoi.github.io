---
title: mkdocs에서 링크된 문서를 새 창으로 열기
date: 2022-10-23
---

mkdocs로 만든 웹사이트에서 링크를 클릭하면 현재 창에 연결된 문서가 뜬다. 가끔 불편한 점은 외부 문서나 주피터 노트북을 변환한 html 파일을 링크하면 내 홈페이지를 벗어나 버려 돌아오기가 번거롭다. 일부 링크는 새 창으로 띄우면 더 편리할 것 같아 찾아보았다. 

1. 먼저 mkdocs.yml 파일을 수정한다. markdown_extensions 부분에 attr_list를 추가한다.

```yml
markdown_extensions: 
  - attr_list
```

2. 마크다운 문서에서 새 창으로 띄울 문서의 링크를 아래처럼 뒤에 {target=_blank}를 추가한다.

```[내 홈페이지](https://lazychoi.github.io){target=_blank}```
