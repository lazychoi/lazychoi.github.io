---
layout: post
title:  "jekyll을 이용해 github 블로그 만들기 7 - 첫화면 목록에 내용 일부 표시"
date:   2014-11-16
categories: Computer
tags : [github, jekyll, blog, 깃허브, 지킬, 블로그]
---

첫화면에 포스트의 제목과 날짜 목록이 표시된다. 제목만 나타나는 것보다 내용도 함께 있었으면 좋겠다. 한참을 헤맨 끝에 우연히 [지킬 문서](http://jekyllrb-ko.github.io/docs/posts/)에 방법이 있는 걸 발견했다. 이미 읽었던 글인데 전에는 보아도 이해를 할 수 없었다. 자꾸 하다보니 이해할 수 있는 부분이 늘어난다.

index.html에 `post.excerpt`를 추가한다. 그러면 각 포스트의 첫 문단만 표시된다.

{%raw%}
	{% for post in paginator.posts %}
	  <div class="potal-list">
	    <p>
	      <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
	      <span>{{ post.date | date: "%m월 %d일, %Y년" }}</span>
	      <span>{{ post.excerpt }}</span>
	      <!-- <span>{{ post.description}}</span> -->
	    </p>
	  </div>
	{% endfor %}
{%endraw%}