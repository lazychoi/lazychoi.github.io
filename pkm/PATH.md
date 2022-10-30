---
title: 리눅스 PATH
date: 2022-10-06
---

- 의미: OS가 특정 프로그램을 찾기 위해 사용하는 디렉토리들의 집합
- 현재 PATH에 잡혀있는 디렉토리 보기: `$ echo $PATH`
- 특정 폴더(eg. ~/bin)를 PATH에 추가하기: `$ PATH=~/bin:$PATH` or `$ export $PATH=/bin`
- 특정 폴더를 영구적으로 PATH에 포함하려면 `~/.bashrc`에 추가

## 기능

- 파일을 $PATH에 지정한 경로 중 한 곳에 놓으면 어느 경로에서든 실행할 수 있다.
- 대부분 프로그램은 `/usr/local/bin/`에 설치된다.
- PATH 경로에 놓인 프로그램은 `$ which` 명령으로 위치를 찾을 수 있다.
