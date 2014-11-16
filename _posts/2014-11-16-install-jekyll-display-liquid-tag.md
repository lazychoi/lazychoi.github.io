---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 6 - liquid tags 표시"
date:   2014-11-16
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

몇 일만 지나가도 새까많게 잊어버리는 기억력을 보완하고자 이곳에 블로그 설치 과정을 기록하고 있는데, 문제가 생겼다. 코드를 포스트에 입력하는데, 그대로 표시되지 않고 실행되어버리는 것이다. 마크다운 문법에서는 탭(스페이스바 4칸)을 누르고 코드를 입력하면 표시가 된다. 그런데, jekyll에서 사용하는 liquid 태그는 바로 실행되어 버린다. 

이렇게 표시되어야 하는데

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

이렇게 표시되어 버린다.

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

### 해결 방법

입력할 코드를 &#123;%raw%&#125;와 &#123;%endraw%&#125;로 감싼다.

그런데, 정작 &#123;%raw%&#125;와 &#123;%endraw%&#125;를 입력하려니 화면에 표시되지 않는다. 결국 "{"의 html 코드값인 `&#123;`과 "}"의 html 코드값인 `&#125;`로 입력하고나서야 표시가 된다.

### 참고 사이트

[http://truongtx.me/2013/01/09/display-liquid-code-in-jekyll/](http://truongtx.me/2013/01/09/display-liquid-code-in-jekyll/)
[Liquid for Designers](https://github.com/Shopify/liquid/wiki/Liquid-for-Designers)