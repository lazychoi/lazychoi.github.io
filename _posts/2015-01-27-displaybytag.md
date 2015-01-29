---
layout: post
title: 지킬 블로그 공부 3 - 태그 목록 만들기
categories: [computer]
tags: [지킬, jekyll]
published: True
---

블로그에서 원하는 주제와 관련된 글을 찾고 싶을 때 태그를 이용하면 편리하다. 태그 목록을 만들고 태그를 누르면 해당 포스트 목록이 나열되는 문서를 만들어 보자.

## 태그 메뉴 만들기

루트디렉토리에 `tags.html`이란 이름의 파일을 만들고, 머리말에 아래 코드를 입력하면 우측 상단에 메뉴로 나타난다.

	---
	layout: default
	title: TAGS
	---

![첫화면에 태그 링크 표시](/images/jekyll-post-tags1.png)

내용을 아무 것도 입력하지 않아 TAGS를 눌러도 문서 제목에 TAGS만 표시되고 아무 것도 없다.

![내용 없는 태그 문서](/images/jekyll-post-tags2.png)

## 태그 이름 표시하기

이제 태그 목록을 불러오자. `for문`을 이용한다. `site.tags`는 포스트에 있는 모든 태그를 가리킨다. 

	{% raw %}
	{% for tag in site.tags %}

	  {{ tag }}

	{% endfor %}
	{% endraw %}

예상 외의 결과가 나온다. 태그만 출력되는 게 아니라 글 전체가 출력된다. 화면을 찬찬히 보니 태그가 먼저 출력되고 다음 줄부터 태그가 포함된 글들이 표시된다. 아마도 site.tags는 [[태그, 포스트, 포스트, ...], [태그, 포스트, ...]] 구조로 이루어진 듯하다.

![태그 표시 오류](/images/jekyll-post-tags3.png)

`site.tags`의 정체를 파악하기 위해 리퀴드 문서를 찾아봤다. [리스트에서 원하는 부분만 출력할 수 있는 방법](http://docs.shopify.com/themes/liquid-documentation/tags/iteration-tags/)이 있을 테니까. `limit: index`와 `offset: index`를 이용하면 된다. limit은 index번호까지만 출력하라는 것이고, ofset은 index번호 이후부터 출력하라는 명령이다. 예시문을 보니 index는 1부터 시작한다. 테스트를 해보자. 태그 목록을 구분하기 위해 `<hr>` 태그로 구분선을 넣었다.

	{% raw %}
	{% for tag in site.tags limit: 1 %}

	  {{ tag }}
	  <hr>

	{% endfor %}
	{% endraw %}

첫번째 태그 이름과 그 태그가 지정된 글 내용이 출력된다. `limit: 2`로 바꾸니 태그 이름 두 개와 해당 글이 출력된다. 그렇다면 위에서 추측한 구조와 얼추 비슷한 것 같다. 그러면 내부 리스트의 첫번째 원소만 꺼내면 태그 이름만 출력할 수 있다. 리퀴드 문서를 찾아보니 [첫번째 원소만 출력하는 필터](http://docs.shopify.com/themes/liquid-documentation/filters/array-filters/)가 있다. `first`다. 태그만 출력하기 위해 아래처럼 필터를 추가했다.

	{% raw %}
	{{ tag | first }}
	{% endraw %}

태그가 잘 출력된다. 

![태그 목록 출력](/images/jekyll-post-tags4.png)

## 태그를 누르면 관련 글 목록 출력하기

다음으로 태그를 누르면 글 목록을 출력하는 코드를 만드는 것은 지금 내 능력으론 불가능하다. 검색으로 코드를 찾아보자. [Another developer blog](http://erjjones.github.io/blog/Part-two-how-I-built-my-blog/)에 적절한 코드가 있다. 이것을 적용하자.

우선 태그 목록을 출력하는 tags.html 파일에 넣을 코드다. 위에서 만든 코드와 거의 같다.

	{% raw %}
	<ul>
	    {% for tag in site.tags %}		
	        <li><a href="/tags/{{ tag[0] }}">{{ tag[0] }}</a></li>
	    {% endfor %}
	</ul>
	{% endraw %}

코드의 `<a href'`를 보니 이 문서가 제대로 작동하려면 `tags/`폴더에 태그별 글목록 파일이 있어야 한다. 루트디렉토리에 `tags/`폴더를 만든다. 태그별 글목록 파일은 다음 두 개의 파일에서 자동으로 만들어 준다.

- tag_gen.rb: 태그를 지정한 문서 목록을 만드는 지킬 모듈이다. 루트디렉토리에 `_plugins/`폴더를 만들어 그 안에 파일을 넣는다.
- tag_index.html: 태그 페이지에 목록을 표시하기 위한 레이아웃 문서다. `_layout/`폴더에 넣는다. 

베낀 tag_gen.rb 코드

	{% raw %}
	module Jekyll
	 
	  class TagIndex < Page    
	    def initialize(site, base, dir, tag)
	      @site = site
	      @base = base
	      @dir = dir
	      @name = 'index.html'
	 
	      self.process(@name)
	      self.read_yaml(File.join(base, '_layouts'), 'tag_index.html')
	      self.data['tag'] = tag
	      self.data['title'] = "Posts Tagged &ldquo;"+tag+"&rdquo;"
	    end
	  end
	 
	  class TagGenerator < Generator
	    safe true
	    
	    def generate(site)
	      if site.layouts.key? 'tag_index'
	        dir = 'tags'
	        site.tags.keys.each do |tag|
	          write_tag_index(site, File.join(dir, tag), tag)
	        end
	      end
	    end
	  
	    def write_tag_index(site, dir, tag)
	      index = TagIndex.new(site, site.source, dir, tag)
	      index.render(site.layouts, site.site_payload)
	      index.write(site.dest)
	      site.pages << index
	    end
	  end
	 
	end
	{% endraw %}

베낀 tag_index.html 코드

	{% raw %}
	<h2>{{page.title}}</h2>
	<table class="table table-striped">
	  <tbody>
		{% for post in site.posts %}	
		{% for tag in post.tags %}
		{% if tag == page.tag %}
		<tr>
		  <td>
			<h3><a href="{{ post.url }}">{{ post.title }}</a></h3>
			<p><strong>{{ post.date | date: "%B %e, %Y" }}</strong> . {{ post.category }} . <a href="http://erjjones.github.com{{ post.url }}#disqus_thread" data-disqus-identifier="{{ post.url }}"></a>
			<br/><small><i>{{ post.summary }}</i></small>
			<br/><small><i class="icon-tags"></i> {% for tag in post.tags %} <a href="/tags/{{ tag }}" title="View posts tagged with &quot;{{ tag }}&quot;"><u>{{ tag }}</u></a>  {% if forloop.last != true %} {% endif %} {% endfor %} </small></p>
		  </td>
		</tr>
		{% endif %}
		{% endfor %}
		{% endfor %}			
	  </tbody>
	</table> 
	{% endraw %}

모든 파일을 만들고 실행하니 아래처럼 오류가 발생한다.

![태그가 머리글에 출력](/images/jekyll-post-tags5.png)

![글꼴 깨짐](/images/jekyll-post-tags6.png)

우선 화면 상단에 `Posts Tagged "태그 이름"`으로 잔뜩 출력되는 것을 없애보자. 아마도 `tags/`폴더 아래에 만들어진 `태그별 폴더/index.html`를 메뉴로 인식하는 듯하다.(최종으로 변환된 문서가 저장되는 `_site`폴더에서 확인) 메뉴가 어떻게 만들어지는지 `_layouts/`폴더 안에 있는 문서를 살펴보자.

`_layouts/`폴더 안에는 현재 파일 네개가 있다.

- default.html
- page.html
- post.html
- tag_index.html

default.html 파일 내용은 아래와 같다. `<head>`태그 안에 head.html파일이 삽입되고, `<body>`태그 안에 header.html파일이 들어간 이후에 우리가 쓴 글이 \{\{ content \}\} 위치에 놓이다. 이후 footer.html파일이 삽입된다.

	{% raw %}
	<!DOCTYPE html>
	<html>

	  {% include head.html %}

	  <body>

	    {% include header.html %}

	    <div class="page-content">
	      <div class="wrapper">
	        {{ content }}
	      </div>
	    </div>

	    {% include footer.html %}

	  </body>

	</html>
	{% endraw %}

다른 레이아웃 파일인 page.html이나 post.html의 맨 윗줄에 'layout:default'가 포함되어 있는 것으로 보아 새로 만든 'tag_index.html'파일 위에도 머리말을 삽입하자. 태그별 글목록에 제목과 날짜만 나오도록 관련없는 코드는 삭제했다.

변경한 tag_index.html 코드

	{% raw %}
	---
	layout: default
	---

	<h2>{{page.title}}</h2>
	<table class="table table-striped">
	  <tbody>
		{% for post in site.posts %}	
		{% for tag in post.tags %}
		{% if tag == page.tag %}
		<tr>
		  <td>
			<strong><a href="{{ post.url }}">{{ post.title }}</a></strong>
			</br>
			- <small>{{ post.date | date: "%Y. %m. %d." }}</small>
		  </td>
		</tr>
		<tr><td></td></tr>
		{% endif %}
		{% endfor %}
		{% endfor %}			
	  </tbody>
	</table> 
	{% endraw %}

이렇게 머리글을 삽입한 후 글자가 깨지는 문제가 해결됐다. 아마도 head.html파일에 있는 `<meta charset="utf-8">`이 적용된 것 같다. 실제로 화면 구성에 관여하는 파일은 `header.html`이다. 이 파일을 다음처럼 수정해 메뉴를 `주제 목록`과 `이곳은...`으로 단순하게 표시했다.

	<header class="site-header">

	  <div class="wrapper">

	    <a class="site-title" href="{{ site.baseurl }}/">{{ site.title }}</a>

	    <nav class="site-nav">
	        <a href="{{ site.baseurl }}/tags.html">주제 목록</a> | <a href="/about/">이곳은...</a>
	    </nav>

	  </div>

	</header>

지금까지 결과다.

![주제 목록 화면](/images/jekyll-post-tags7.png)

![태그별 목록 화면](/images/jekyll-post-tags8.png)

깃허브에 업로드한 뒤 다시 문제가 발생했다. 태그를 만드는 플러그인이 `_site/`폴더 밑의 `tags/`폴더에만 태그 목록을 만들고 루트디렉토리의 `tags/`폴더에는 아무 문서도 만들지 않아 오류가 난 것이다. 플러그인을 만든 사람의 글을 다시 읽어보니 두 가지 사항을 지켜야 한다.

1. 태그를 새로 추가하면 로컬 서버를 재실행해야 한다.
2. `_site/tags/`폴더 내의 폴더와 파일을 `tags/`폴더로 복사한 뒤 깃허브에 올린다.
