---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 5 - 카테고리, 태그 목록"
date:   2014-11-16
description: "포스트를 카테고리별, 태그별 정렬하는 페이지 만들기"
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

블로그 첫 화면이 날짜별로 포스트가 배열되기만 하면 나중에 찾기가 불편할 것이다. 그래서 주제별, 태그별로 포스트 목록이 나열된 페이지가 필요하다. 이곳 저곳을 검색하다 결국 구글에서 답을 얻었다.

### 주제별 포스트 목록 만들기 

root 디렉토리에 categories.html 파일을 만들어 아래 코드를 입력한다.

{%raw%}
	---
	layout: default
	---

	<div class="potal-list">
	{% for category in site.categories %}  
		<li><h2>{{ category | first }}</h2>
	    <ul>
	    {% for posts in category %}
	      {% for post in posts %}
	      	{% if post.url %}
		        <li><a href="{{ post.url }}">{{ post.title }}</a></li>
		    {% endif %}
	      {% endfor %}
	    {% endfor %}
	    </ul>
	  </li>
	{% endfor %}
	</div>
{%endraw%}

### 태그별 포스트 목록 만들기

root 디렉토리에 categories.html 파일을 만들어 아래 코드를 입력한다.

{%raw%}
	---
	layout: default
	---

	<div class="potal-list">
	{% for tag in site.tags %}  
		<li><h2>{{ tag | first }}</h2>
	    <ul>
	    {% for posts in tag %}
	      {% for post in posts %}
	      	{% if post.url %}
		        <li><a href="{{ post.url }}">{{ post.title }}</a></li>
		    {% endif %}
	      {% endfor %}
	    {% endfor %}
	    </ul>
	  </li>
	{% endfor %}
	</div>
{%endraw%}

### 남은 문제

포스트 양이 늘어나면 한정없이 문서가 길어질 것이다. 이를 보완하는 방법을 고안해야 한다.

### 참고 사이트

- [stackoverflow QA](http://stackoverflow.com/questions/20872861/jekyll-display-posts-by-category)