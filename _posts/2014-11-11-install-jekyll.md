---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 1"
date:   2014-11-12
description: "깃허브를 이용해 블로그를 만드는 방법"
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

github을 접한 후 프로그래밍할 때뿐만 아니라 글을 쓸 때도 잘 이용할 수 있다는 것을 알게 됐다. 버전관리를 할 수 있다는 것, 무엇보다 온라인에 접속할 필요없이 노트북에서 글을 쓰면 된다는 점에 끌렸다. 문제는 프로그래밍 지식이 거의 없다는 데 있다. 하지만 구글신의 도움을 받아 조금씩 조금씩 하면 될 거다.

### jekyll 실행

1. github 저장소명과 동일한 이름의 폴더 만들기

	jekyll new lazychoi.github.io

2. 폴더 안으로 이동

	cd lazychoi.github.io

3. 지킬 서버 시작

	jekyll serve --watch

### 로컬에서 확인

1. 웹브라우저에 localhost:4000 입력하면 아래 화면이 뜬다.

![초기 화면](/images/jekyll-first-screen.png)

### 화면 구성 관련 파일

![초기 화면](/images/jekyll-screen-to-file.png)

### _config.yml 파일 변경

내용을 변경한 뒤 웹브라우저에서 확인해도 반영되지 않는 경우가 있다.<br />
이럴 때는 터미널에서 ctrl+c 로 서버를 종료한 뒤
jekyll serve --watch 를 입력해 재시작한다.

### 참고 사이트

- [놀부 블로그](http://nolboo.github.io/blog/2013/10/15/free-blog-with-github-jekyll/)
- [jekyll blog](http://jekyllrb-ko.github.io)
- [intro to Jekyll 동영상 강의](http://youtu.be/O7NBEFmA7yA)