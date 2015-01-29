---
layout: post
title: "영어 단어장 만들기 서블라임 텍스트 플러그인"
categories: computer
tag: [sublimetext plugin, 영어 단어장 만들기]
---

![영어 단어장 플러그인 소개](/images/intro_making_english_wordbook.gif)

**[ 단축키 목록 ]**

|        기능       |         맥          |     윈도우      |
| ----------------- | ------------------- | --------------- |
| 단어 뜻 검색      | shift + command + j | shift + alt + j |
| 네이버 사전 검색  | shift + command + k | shift + alt + k |
| 단어 입력 후 탭키 | command + tab       | ctrl + tab      |
| 프로그램 전환     | command + tab       | ctrl + tab      |


## 1. 서블라임 텍스트(Sublime Text) 3 다운 및 설치

**윈도우즈 사용자**는 플러그인이 모두 설치되어 있는 아래 파일을 받는다. 압축을 풀고 `sublime_text.exe` 파일을 실행한다. 사전 파일은 `단어장 파일/`폴더 안에 있다.

[윈도우즈 32비트용 포터블 버전](/data/Win32 Sublime Text Build 3065.zip)

**맥 사용자**는 아래 링크를 눌러 서블라임 텍스트 3 프로그램, 영어 단어장 플러그인, 영어사전 파일을 받는다.

[서블라임 텍스트 3 프로그램](http://www.sublimetext.com/3)
[맥 사용자를 위한 영어 단어장 플러그인](https://github.com/lazychoi/makeEnglishWordbook/archive/master.zip)
[영어 사전 파일](/data/eng_dic_data.txt)

서블라임 텍스트 3를 설치한 뒤 프로그램을 실행한다. 내려받은 플러그인도 압축을 풀고 폴더째로 `Packages/`폴더 밑으로 옮긴다. Packages/폴더는 `Sublime Text > Preferences > Browse Packages ...`를 선택하면 나온다.

## 2. 영어 단어장 플러그인의 기능

영어 단어장 플러그인은 네 가지 기능이 있다. 각각을 눌러 사용법을 보기 바란다. 

1. 사전 파일에 있는 단어 풀이를 가져와 단어장에 입력하기( shift + command[alt] + j )
2. 네이버 사전 찾기( shift + command[alt] + k )
3. 사전 파일에 단어 추가하기( shift + command[alt] + i )
4. 사전 파일 수정하기( shift + command[alt] + m )

## 3. 주의사항

1. 사전 파일은 인터넷에 떠도는 것을 사용했습니다. 혹시라도 저작권에 위반되면 즉시 알려주길 바랍니다. 배포를 중단하겠습니다. 
2. 단어장 이름은 무엇이든 관계없지만, 사전 파일 이름은 `eng_dic_data.txt`를 유지해야 합니다. 이름을 변경하면 3번, 4번 기능이 작동하지 않습니다.

