---
layout: post
title: "마크다운으로 프레젠테이션 문서 만들기"
categories: computer
tag: [마크다운, 프레젠테이션, 파워포인트, 수업, markdown, presentation, powerpoint, teaching]
---

수업 자료를 만들 때마다 학생들에게 나눠주는 프린트 자료와 화면에 출력하는 프레젠테이션 자료를 한 번에 만들면 좋겠다고 생각했다. 키노트로 만들면 모양을 꾸미는데 시간을 더 썼다. 결국, 엑셀로 화면에 띄울 수 있게 작업을 하고 그것을 프린트와 프레젠테이션용으로 사용했다.

평소에 마크다운으로 글을 쓰다 이것을 그대로 프레젠테이션으로 바꿔주는 방법이 있을 거라는 생각이 들었다. 서블라임 텍스트 플러그인이 있을까 패키지 컨트롤에서 검색을 하니 "Markdown Slideshow"이 있다. 서블라임 텍스트에서 한방에 만들어주긴 하지만 초기 화면과 두번째 화면에 구글 로고가 고정되어 있고, 결정적으론 이미지를 로컬에서 삽입할 수 없다는데 문제가 있다. 

다른 방법을 찾아보니 HTML을 프레젠테이션 문서로 바꿔주는 방법은 여러가지가 있고, "pandoc"이란 프로그램을 이용해서 마크다운을 프레젠테이션 형식의 HTML로 변환할 수 있었다. 특히 [s5](http://meyerweb.com/eric/tools/s5/)는 프린트 문서와 프레젠테이션 문서를 동시에 이용할 수 있고 모양도 예쁘게 나온다. 문제는 s5 문서는 HTML로 작성을 해야 해서 번거롭고 가독성도 떨어지며, pandoc으로 변환할 때는 s5의 기능을 모두 사용할 수 없는 것 같다.

다시 검색을 해서 [remark](https://github.com/gnab/remark/wiki)란 프로그램을 찾았다. 기본 틀은 HTML인데 외부 자바스크립트 파일을 이용해 사용자가 입력한 마크다운을 HTML로 변환한다. 매뉴얼도 상세하게 되어 있고 로컬 이미지도 잘 들어간다. HTML 템플릿은 스니핏을 이용하면 해결될 것 같다. 우선 이것을 사용해보기로 했다.

스티핏 코드는 다음과 같다.

    <snippet>
        <content><![CDATA[
    <!DOCTYPE html>
    <html>
      <head>
        <title>${1:Title}</title>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
        <style type="text/css">
          @import url(http://fonts.googleapis.com/css?family=Yanone+Kaffeesatz);
          @import url(http://fonts.googleapis.com/css?family=Droid+Serif:400,700,400italic);
          @import url(http://fonts.googleapis.com/css?family=Ubuntu+Mono:400,700,400italic);

          body { font-family: 'Droid Serif'; }
          h1, h2, h3 {
            font-family: 'Yanone Kaffeesatz';
            font-weight: normal;
          }
          .remark-code, .remark-inline-code { font-family: 'Ubuntu Mono'; }
        </style>
      </head>
      <body>
        <textarea id="source">

    class: center, middle

    # {2:Title}

    ---

    # {3:Title}

    1. Introduction
    2. Deep-dive
    3. ...
     

        </textarea>
        <script src="remark-latest.min.js" type="text/javascript">
        </script>
        <script type="text/javascript">
          var slideshow = remark.create();
        </script>
      </body>
    </html>
    ]]></content>
        <!-- Optional: Set a tabTrigger to define how to trigger the snippet -->
        <tabTrigger>slide</tabTrigger>
        <!-- Optional: Set a scope to limit where the snippet will trigger -->
        <scope>text</scope>
    </snippet>


서블라임 텍스트에서 "slide"를 입력한 뒤 탭키를 누르면 
파일이름을 "마음대로.html"로 저장한 뒤 더블클릭하면 웹브라우저에 프레젠테이션이 열린다.