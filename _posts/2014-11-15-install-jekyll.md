---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 3 - 첫 화면에 5개 목록 표시"
date:   2014-11-15
description: "첫 화면에 포스트 목록 5개와 이동 링크 표시"
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

### 참고 자료

- [intro to Jekyll 동영상 강의](http://youtu.be/O7NBEFmA7yA)
- [놀부 블로그](http://nolboo.github.io/blog/2014/01/09/upgrade-jekyll-github-blog/)

### config.yml에 다음 문장 추가

	paginate: 5
	paginate_path: "blog/page:num"
	
한 페이지에 5개 포스트를 추가한다는 것이고, 변환된 파일은 _site 폴더 아래 blog 폴더 안에 생성됨

### index.html 파일을 수정

[jekyll 문서](http://jekyllrb-ko.github.io/docs/pagination/)에 따라 변경


### 문제 발생

1. 블로그 내용 전부가 아니라 일부만 표시하는게 좋을 것 같은데, 방법을 모르겠음




