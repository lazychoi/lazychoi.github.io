---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기"
date:   2014-11-12
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

## jekyll 실행

1. github 저장소명과 동일한 이름의 폴더 만들기

	jekyll new lazychoi.github.io

2. 폴더 안으로 이동

	cd lazychoi.github.io

3. 지킬 서버 시작

	jekyll serve --watch

## 로컬에서 확인

1. 웹브라우저에 localhost:4000 입력하면 아래 화면이 뜬다.

![초기 화면](/images/jekyll-first-screen.png)

## 화면 구성 관련 파일

![초기 화면](/images/jekyll-screen-to-file.png)

## _config.yml 파일 변경

내용을 변경한 뒤 웹브라우저에서 확인해도 반영되지 않는 경우가 있다.<br />
이럴 때는 터미널에서 ctrl+c 로 서버를 종료한 뒤
jekyll serve --watch 를 입력해 재시작한다.

## 그림 파일 추가

하위 폴더를 만들어 사용하지 않는다면, 루트 폴더 밑에 images와 같이 임의의 폴더를 만들어 그림 파일을 그곳에 저장한다. 

사용방법은

	![그림파일](/images/그림파일명)

	