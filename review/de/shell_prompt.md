---
title: "shell prompt"
date: 2022-10-07
updated: last-modified
---

출처: [How To Customize Bash Prompt in Linux](https://phoenixnap.com/kb/change-bash-prompt-linux){target=_blank}

## bash prompt 기본값

- eg. `(base) aaa@DESKTOP:~$` 또는 `aaa@DESKTOP:~$`
- 의미: (아나콘다 가상환경) 사용자명@호스트명:
- `~`: 사용자의_루트디렉토리
- `$`: 일반 사용자 표시
- `#`: root 사용자 표시

## bash prompt 변경: `~/.bashrc` 파일

- ~/.bashrc 파일 변경. 만일을 위해 백업 파일 만들기(~/.bashrc.bak)
- ==파일 내용을 변경한 뒤에는 재실행==하여 변경사항 반영: `source ~/.bashrc`

특정 문자를 프롬프트에 표시

- .bashrc 파일 마지막에 `PS1="MyTestPrompt> "` 추가
- 결과: `MyTestPrompt>`

임시로 프롬프트 변경하기: `export` command

- 현재 사용자가 로그아웃할 때까지 유지됨
- `MyTestPrompt> export PS1="\u >"`
- 결과: `aaa >`
- `\u`: 현재 사용자명을 프롬프트에 표시

사용자명과 도메인명 표시

- `export PS1="\u\H "`
- 결과: `aaaDESKTOP`
- `\H`: 전체 hostname 표시

특수문자 표시

- `export PS1="\u@\H :"`
- 결과: `aaa@DESKTOP :`
- 프롬프트 끝은 사용자가 입력한 명령과 구분하기 위해 특수문자를 배치하는 게 좋다.

사용자명과 셀이름, 버전 표시

- `export PS1="\u@\s\v> "`
- 결과: `aaa@bash5.1>`

사용자명과 요일 월 일 표시

- `export PS1="\u(\d)>`
- 결과: `aaa(Fri Oct 07)>`

사용자명과 시:분:초 표시

- `export PS1="\u(\t)>"`
- 결과: `aaa(17:25:07)>`
- 12시간제로 표시하려면 `\T` 사용
- "시간:분"만 표시하려면 `\A` 사용

프롬프트의 모든 정보 감추기(디렉토리만 표시)

- `export PS1="\W >"`
- 결과: `~ >`

root 사용자와 일반 사용자 구분

- `export PS1="\W$ "`
- 결과: `~$`
- `~$ sudo su` 명령어로 root 사용자로 전환하면 프롬프트가 `#`으로 바뀜
- `# exit` 명령어로 로그아웃하면 다시 일반 사용자 프롬프트로 전환됨

글자색 바꾸기

- `export PS1="\e[0;32m[\u: \W]\$ \e[0m"`
- 결과: `[playdata: ~]$` (초록색)
- `\e[`: 색상 지정 시작
- `\e[0m`: 색상 지정 끝
- 색상코드의 첫 번째 숫자
	- 0 : Normal  
	- 1 : Bold (bright)  
	- 2 : Dim  
	- 4 : Underlined
- 두 번째 숫자
	- 30 : Black
	- 31 : Red
	- 32 : Green
	- 33 : Brown
	- 34 : Blue
	- 35 : Purple
	- 36 : Cyan
	- 37 : Light gray

## 유용한 사이트

- [기타 다른 명령어 보기](https://ss64.com/bash/syntax-prompt.html){target=_blank}
- [PS1 명령어 생성기](https://bashrcgenerator.com/){target=_blank} : 드래그 앤 드랍으로 .bashrc에 입력할 속성값을 쉽게 만들 수 있다.
