---
title: git
date: 2022-10-30
---

## 환경 설정

- 기존 환경 설정 파일 삭제: `git config --unset 이메일 주소`
- 이메일 주소는 git이 개발자를 구별하는 고유의 키 값으로 사용: `git config user.email "이메일 주소"`
- 환경설정 파일 보기: 먼저 `ls .git` 명령으로 config 파일 존재 유무 확인 >>> `vi .git/config` 글로벌 사용자 등록을 했다면 `vi ~/.gitconfig`

## 로그

- 로그 보기 명령: `git log --graph --pretty=oneline` >>> show-grpah 별칭으로 등록: `git config --global alias.show-graph 'log --graph --pretty=oneline'`

## 기타

- [gitignore가 적용 안 될 때](./gitignore_not_working.md)
