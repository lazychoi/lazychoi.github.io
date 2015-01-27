---
title: "서블라임 텍스트(sublime text) 3 스니펫(snippet) 이용하기"
categories: [computer]
tags: [서블라임 텍스트, 스니펫, sublime text, snippet, 지킬 블로그, jekyll blog]
published: True
---

깃헙(github) 블로그에 글을 올리려면 문서 상단에 다음과 같은 [머리말](http://jekyllrb-ko.github.io/docs/frontmatter/)을 넣어야 한다. 그런데 매번 글을 작성할 때마다 넣어야 하니 여간 번거로운게 아니다.

	---
	layout: post
	title: Blogging Like a Hacker
	---

여기에 data, categories, tags도 필요하다. 따라서 문서를 만들면 아래처럼 5가지 항목이 자동으로 입력되고 커서가 입력 위치에 있었으면 좋겠다.

    ---
    layout: post
    title: |  <- 여기에 커서 위치
    data: <- 탭을 누르면 다음 입력 위치로 이동
    categories: <- 탭을 누르면 다음 입력 위치로 이동
    tags: <- 탭을 누르면 다음 입력 위치로 이동
    ---

## 스니펫(snippet) 파일 만들기

서블라임텍스트(sublime text)에 이런 기능이 있는지 찾아보니 바로 스니펫(snippet)이 이 용도로 쓰인다는 걸 알았다. 스니펫이란 자동으로 코드 블록을 만들어 주는 기능이다. 어떻게 만들까? 플러그인 만들 때 사용했던 메뉴 바로 밑에 스니펫을 만드는 메뉴가 있다. `Tools > New snippet....`를 선택하면 아래와 같은 템플릿이 입력된 파일이 열린다. 

    <snippet>
        <content><![CDATA[
    Hello, ${1:this} is a ${2:snippet}.
    ]]></content>
        <!-- Optional: Set a tabTrigger to define how to trigger the snippet -->
        <!-- <tabTrigger>hello</tabTrigger> -->
        <!-- Optional: Set a scope to limit where the snippet will trigger -->
        <!-- <scope>source.python</scope> -->
    </snippet>


이게 무슨 말이지? 어떻게 이용해야하지? 검색을 해보자. 구글에서 "sublime text 3 how to make snippet"를 키워드를 입력하니 "how to make snippets in sublime text 3"란 추천 검색어가 뜬다. 당연히 추천 검색어를 이용했다. 몇 개 글을 읽어보니 `<content><![CDATA[` 와 `]]></content>` 사이에 넣고 싶은 코드를 넣으면 된단다. `${1:}`, `${2:}`는 코드가 적용된 다음에 커서가 위치하는 곳이다. 우선 저장하고 실행하는 방법부터 찾자. 그래야 하나하나 테스트하며 익힐 수 있다. 

## 스니펫 파일 저장하고 실행하기

저장을 누르면 "~/.../Packages/User" 폴더가 열린다. 이곳에 저장하면 된다. 파일명은? "내마음대로.sublime-snippet"으로 저장한다. 나는 test.sublime-snippet으로 저장했다. 

그럼 실행은 어떻게 할까? 위의 샘플 코드를 보면 `<!-- <tabTrigger>hello</tabTrigger> -->` 코드가 있다. 이름이 tabTrigger인걸 보니 hello글자를 입력한 후 `tab`키를 누르면 `Hello, this is a snippet.`이 입력되고 this가 선택되는 것 같다. 주석 표시인 <!-- -->을 없애고 실행을 해보니 `${1}`이 있던 this가 선택된 상태다. `tab`을 한 번 더 누르니 snippet이 선택된다. 

아래의 <socpe></socpe>는 스니펫이 적용될 파일 형식을 지정하는 것 같다. 내 경우에는 `text`로 하자. 이유는 [서블라임 텍스트 문서](http://docs.sublimetext.info/en/sublime-text-3/extensibility/syntaxdefs.html#scopes-and-scope-selectors)에 아래와 같이 정의되어 있기 때문이다.

> **scopeName**
> : The top level scope for this syntax definition. It takes the form `source.<lang_name>` or `text.<lang_name>`. For programming languages, use `source`. For markup and everything else, use `text`.

사용을 해보니 스니펫은 프로그램뿐만 아니라 워드프로세서의 상용구처럼 자주 쓰는 단어나 문장, 형식을 등록해서 쓸 수 있겠다.

## 최종 코드

	<snippet>
		<content><![CDATA[
	---
	layout: post
	title:  "${1}"
	categories: ${2}
	tags : [${3}]
	---
	]]></content>
		<!-- Optional: Set a tabTrigger to define how to trigger the snippet -->
		<tabTrigger>jekyll</tabTrigger>
		<!-- Optional: Set a scope to limit where the snippet will trigger -->
		<scope>text</scope>
	</snippet>


## 후기 

스니펫을 만들고 나서 혹시나 하는 마음에 서블라임 패키지 컨트롤에 지킬 관련 플러그인이 있는지 검색해 보았다. 역시 있다. [jekyll](https://packagecontrol.io/packages/Jekyll)이란 이름의 플러그인이다. 아래처럼 command palette를 이용해도 되고, 단축키를 활용해도 된다.

![서블라임 텍스트 지킬 블로그 플러그인](/images/jekyll-blog-plugin.png)

