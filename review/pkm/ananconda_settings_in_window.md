---
title: ananconda settings in window
date: 2022-10-26
---

## 환경변수 등록

1. 윈도우 키 >>> 설정 >>> 시스템 >>> 정보 >>> 고급 시스템 설정 >>> '환경변수' 버튼 클릭
2. 상단의 사용자 변수 블록 >>> 변수 열의 Path 선택 >>> '편집' 버튼 클릭
3. '새로만들기' 버튼 클릭 후 아래 경로 입력

C:\ProgramData\Anaconda3
C:\ProgramData\Anaconda3\Library
C:\ProgramData\Anaconda3\Scripts

주의!!! 시스템에 따라 설치 경로가 다를 수 있으니, ananconda 설치 과정에서 보여지는 경로를 잘 기억하자.

4. '확인' 버튼을 누르고 나온다.

## powershell에서 작업

- 윈도우 기본 파워셀에서 작업하면 conda 가상환경이 실행되지 않았다.
- 아나콘다파워셀을 실행시켜서 작업한다.
- vscode를 실행할 때도 아나콘다파워셀에서 `coda .`을 입력해 실행해야 터미널에서 아나콘다파워셀이 뜬다.
