---
layout: post
title:  "Writing Sublime Plugins 요약 1"
date:   2014-11-19
categories: Computer
tags : [Sublime text, plugin]
---

### 7장 구현 방법 개관

플러그인의 목적은 **키보드 단축키를 누를 때 실행되는 명령어 이름을 서블라임의 상태막대에 표시**하는 것이다.

필요한 작업을 간단히 훑어보면,

1. 사용자가 키보드를 누르는 것을 알아채는 방법: **event listener**를 이용한다.
2. 누른 키에 해당하는 명령어 이름을 얻는 방법
	1. sublime 어딘가에 단축키와 명령어 이름이 정리된 파일이 있지 않을까?
	2. sublime의 명령어 로그(명령어 이름을 콘솔에 기록)를 이용하는 방법
	3. sublime의 명령어 히스토리의 마지막 항목을 가져오는 방법
3. 명령어 이름을 snake cast 방식(eg. hello_world)에서 사용자가 원하는 포맷으로 변경한다.
4. 플러그인 작동을 중지하거나 실행할 수 있도록 한다.

### 8장 event listener 의미

sublime_plugin.EventListener는 파이썬 class이다. Text command와 달리 클래스 이름은 자유롭게 해도 된다.

#### 이벤트에 의해 움직이는 플러그인은 어떻게 작동하는가?

파일을 수정하면 **on_modified** event가 작동되고, Sublime이 on_modified methods 목록을 순환하며, 각 요소를 callback으로 실행시킨다. **callback**은 무슨 말일까? event callback이 실행되면, 서블라임은 이벤트에 정의된 모든 파라미터를 전달한다. 

**on_new**가 호출되면 새로운 view 오브젝트(새 탭)에 대한 참조를 얻는다. 

#### 어떤 이벤트를 사용할 수 있는가?

**on_pre_save**는 파일이 저장되기 직전에 실행되고, 
**on_post_save**는 저장 직후에 실행된다. 
**on_query_completions**는 자동채우기(autocomplete)가 실행될 때마다 작동하고
**on_query_context**는 명령을 실행하기 전에 context rule(문법 규칙??)을 체크할 때 작동한다.

on_modified 메서드는 매 키보드 입력에 반응하기 때문에 자칫 서블라임을 먹통으로 만들 수 있다.

#### event listener 기반 플러그인을 만들 때 주의 사항

초보자들은 자신이 만든 플러그인이 이벤트를 살피고 있는 유일한 플러그인이라고 생각하지 말아야 한다. 서블라임은 이벤트 콜백(??)이 실행되는 순서를 정한다. 따라서 자신의 플러그인이 언제 실행될 지 알 수 없다.

throw a monkey wrench into: 
《미 구어》〈계획개혁 등을〉 방해하다, 실패하게 하다, 파괴하다.

**on_text_command** 이벤트는 TextCommand가 실행될 때마다 작동한다. 편집 관련 명령이 실행될 때마다 알려주는 역할을 한다.

두번 째 주의 사항은 느리거나 복잡한 계산을 해야하는 작업을 피하는 것이다. 예를 들면 파일 시스템에서 파일을 로딩하거나, 웹 서비스를 요청하거나 대량의 텍스트를 정규식으로 처리하는 것 등이다. **on_modified**와 **on_selection_modified**를 조심스럽게 사용하라.

