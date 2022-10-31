---
title: Material for MkDocs
date: 2022-10-12
---

## 설치 및 환경설정

1. conda 가상환경 만들기: `$ conda create -n mkdocs`
2. 가상환경 들어가기: `$ conda activate mkdocs`
3. 설치: `$ pip install mkdocs-material`

## 사이트 만들기

`$ mkdir 폴더이름` : 사이트로 구성할 폴더 만들기

`$ cd 폴더이름`

`$ mkdocs new .` : 사이트 기본 파일 생성. 아래와 같은 폴더와 파일을 만든다.

```bash
.
├─ docs/
│  └─ index.md
└─ mkdocs.yml
```

## mkdocs.yml 설정

vscode에 Yaml extension 설치

settings >>> yaml.schemas 아래 코드 추가

```json
{
  "yaml.schemas": {
    "https://squidfunk.github.io/mkdocs-material/schema.json": "mkdocs.yml"
  }
}
```

## 사이트 미리보기

`$ mkdocs serve`

INFO     -  Option search.lang 'kr' is not supported, falling back to 'en'
ERROR    -  Config value: 'plugins'. Error: The "roamlinks" plugin is not installed
Aborted with 1 Configuration Errors!

=> 해당 코드 모두 주석처리한 뒤 실행하니 일단 뜨기는 함

## 사이트 만들기

### github actions 이용하기(선택)

[설명서](https://squidfunk.github.io/mkdocs-material/publishing-your-site/){target=_blank}

### 로컬에서 build한 후에 올리기

`$ mkdocs build`

=> site/ 폴더가 만들어진 뒤 그 안에 변환된 html 파일을 넣음
=> site/ 폴더를 깃허브에 올리면 됨.

## 기타 설정 방법

- [링크 문서 새 창으로 열기](./markdown_link_new_window.md)
