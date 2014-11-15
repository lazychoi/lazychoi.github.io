---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 4 - css 수정"
date:   2014-11-15
description: "읽기 좋은 화면을 만들기 위해 css 파일 편집"
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

![화면과 CSS 파일 연결](/images/jekyll-screen-to-css.png)

소제목 스타일로 사용하는 h2, h3, h4의 모양을 바꿨다. 글자 모양을 바꾸려면 _sass 폴더에 있는 _layout.scss 파일에서 해당 클래스를 찾아 수정해야 한다.

- 화면 최상단의 검은색 수평선과 사이트 이름 하단의 가는 수평선은 .site-header에서 수정
- 사이트 이름은 .site-title에서 수정. _config.yml에서 title에 \<br /> 태그를 이용해 두 줄로 입력하도 된다.
- 포스트 제목은 .post-title에서 수정. 글자 크기가 너무 커서 32px로 줄였다. 가운데 정렬로 바꿨다.

	font-size:32px;font-weight: bold;text-align: center;

- 포스트 제목 밑의 날짜는 .post-meta에서 수정. 역시 가운데 정렬로 바꿨다.
- 포스트 제목과 날짜 사이에 짧은 수평선을 추가했다. post.html파일에 태그를 삽입함.

	\<center>\<hr width="30%">\</center>

- 소제목에 해당하는 h3, h4는 .post-content에서 수정. 글자를 굵게 하고 좌측에 세로 막대를 추가했다.

	h2, h3, h4{font-weight: bold;padding-left: 15px;margin-top: 50px;margin-bottom: 20px;}

	h3{border-left: 5px solid gray;}

- 첫화면에 제목, 날짜, 포스트에 대한 간략한 설명이 표시되도록 .potal-list 클래스를 만들어 _layout.scss 폴더에 추가함.

	.potal-list{
    p{
        font-size: 20px;
        padding-left: 0px;
        margin-bottom: 50px;        
    }
    h2{
        line-height:5px;
    }
}
