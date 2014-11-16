---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 3 - 첫 화면에 5개 목록 표시"
date:   2014-11-15
description: "첫 화면에 포스트 목록 5개와 이동 링크 표시"
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

블로그 첫 화면에 포스트 목록 5개만 표시하도록 하려면 _config.yml 파일과 index.html 파일을 수정한다.

### _config.yml에 다음 문장 추가

	paginate: 5
	paginate_path: "blog/page:num"
	
한 페이지에 5개 포스트를 추가한다는 것이고, 변환된 파일은 _site 폴더 아래 blog 폴더 안에 생성됨

### index.html 파일을 수정

[jekyll 문서](http://jekyllrb-ko.github.io/docs/pagination/)에 따라 변경

{%raw%}
	---
	layout: default
	title: My Blog
	---

	<!-- This loops through the paginated posts -->
	{% for post in paginator.posts %}
	  <h1><a href="{{ post.url }}">{{ post.title }}</a></h1>
	  <p class="author">
	    <span class="date">{{ post.date }}</span>
	  </p>
	  <div class="content">
	    {{ post.content }}
	  </div>
	{% endfor %}

	{% if paginator.total_pages > 1 %}
	<div class="pagination">
	  {% if paginator.previous_page %}
	    <a href="{{ paginator.previous_page_path | prepend: site.baseurl | replace: '//', '/' }}">&laquo; Prev</a>
	  {% else %}
	    <span>&laquo; Prev</span>
	  {% endif %}

	  {% for page in (1..paginator.total_pages) %}
	    {% if page == paginator.page %}
	      <em>{{ page }}</em>
	    {% elsif page == 1 %}
	      <a href="{{ '/index.html' | prepend: site.baseurl | replace: '//', '/' }}">{{ page }}</a>
	    {% else %}
	      <a href="{{ site.paginate_path | prepend: site.baseurl | replace: '//', '/' | replace: ':num', page }}">{{ page }}</a>
	    {% endif %}
	  {% endfor %}

	  {% if paginator.next_page %}
	    <a href="{{ paginator.next_page_path | prepend: site.baseurl | replace: '//', '/' }}">Next &raquo;</a>
	  {% else %}
	    <span>Next &raquo;</span>
	  {% endif %}
	</div>
	{% endif %}
{%endraw%}

### 문제 발생

1. 블로그 내용 전부가 아니라 일부만 표시하는게 좋을 것 같은데, 방법을 모르겠음

11/16일 문제를 해결했다. 방법을 보려면 [이곳](http://#)으로.



### 참고 자료

- [intro to Jekyll 동영상 강의](http://youtu.be/O7NBEFmA7yA)
- [놀부 블로그](http://nolboo.github.io/blog/2014/01/09/upgrade-jekyll-github-blog/)

