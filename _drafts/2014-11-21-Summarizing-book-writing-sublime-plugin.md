---
layout: post
title:  "Writing Sublime Plugins 요약 3"
date:   2014-11-21
categories: Computer
tags : [Sublime text, plugin]
---

## Commands

### 11장 구현 개관

command palette에서 플러그인을 실행시킨 후 퀵 패널에서 단축키를 선택하도록 구현한다. 플러그인이 단축키를 검색하는데 시간이 걸린다. 작은 막대를 이용해 검색 과정 중임을 표시하도록 한다.

1. 설치된 패키지 목록을 모아 작동되지 않는 패키지는 빼고 나머지를 콘솔에 표시한다.
2. 각 패키지를 조사해 키맵 파일 목록을 모은다. 키 바인딩은 JSON 포맷으로 정의되어 있다. 키맵 파일 목록을 뺑뺑이 돌며 JSON을 파이썬 오브젝트로 바꾼다. 이 작업을 백그라운드로 한다.
3. 유저 인터페이스를 만든다.
	1.1. 플러그인을 command palette에 추가
	1.2. 키바인딩 목록을 퀵 패널에 표시
	1.3. 서블라임 상태막대에 플러그인이 작동 중임을 표시
4. 서블라임 메뉴에 플러그인과 키보드 단축키 추가

### 12장 command란 무엇인가?

Commands의 독특한 작명 규칙

클래스명은 반드시 Command로 끝나야 하고, camel casing 방식을 따라야 한다. 플러그인이 로드될 때 어미 Command는 삭제되고, camel casing은 snake casing 방식으로 바뀐다.

run method

모든 command는 반드시 run method를 정의해야 한다. 이는 명령이 실행될 때 서블라임이 호출하는 것으로서 코드의 시작점 역할을 맡는다. 명령의 종류에 따라 파라미터를 받아야 한다.

run method는 두 개의 파라미터를 기본으로 받는다. 즉, self와 Edit다. self는 현 명령의 인스턴스를 가리키고(self의 의미에 관해서는 [점프투파이썬의 클래스 편](https://wikidocs.net/28)에 설명이 잘 되어 있다), Edit은 Edit class의 인스턴스다. Edit class는 작동들을 단일한 단위로 묶어 실행 취소와 재실행을 할 수 있도록 해준다. 서블라임이 Edit 인스턴스를 run method에 전달하면 어떤 텍스트 조작도 editing 작업에 포함될 것이다. edit을 마친 뒤에는 edit.end_edit()을 호출하여 Edit 오브젝트를 닫아야 한다.

run method에 파라미터를 추가할 수 있고 JSON 테이터 타입(String, Boolean, Number)만 가능하다. 왜냐하면 key bindings가 JSON 파일로 만들어지기 때문이다.

### 13장 플러그인을 명령으로 바꾸기

기존의 KeyBindingInspector.py 파일을 삭제한다. 새로운 플러그인 파일을 만들어 아래와 같이 수정한 뒤 show_key_bindings.py로 저장한다.

	import sublime, sublime_plugin

	class ShowKeyBindingsCommand(sublime_plugin.WindowCommand):
		def run(self):
			print("You triggered the Show Key Bindings command.")

콘솔에서 window.run_command("show_key_bindings") 입력하면 You triggered the Show Key Bindings command.가 나타난다. OK.

### 설치된 패키지 목록 만들기

#### 패키지 경로 정하기

sublime.packages_path: 패키지와 플러그인를 로드할 때 스캔하는 디렉토리

플러그인 디렉토리에 lib이라는 이름의 폴더를 만든다. 그 안에 새 파일을 만들어 package_resources.py 이름으로 저장한다.

	import sublime
	import os

		def get_packages_list():
			package_set = set()
			package_set.update(_get_packages_from_directory(sublime.packages_path()))
			return sorted(list(package_set))

		def _get_packages_from_directory(directory):
			package_list = []
			for package in os.listdir(directory):
				package_list.append(package)
			return package_list

- get_packages_list() 함수는 sublime.packages_path()를 이용해 서블라임이 검색할 폴더를 알게 된다.
- set 자료형: 중복을 허용하지 않고 순서대로 정렬되지 않는다. index로 접근할 수 없기 때문에 list()로 변환 후에 접근 가능하다.

lib 폴더에 __init__.py 파일 만든다.(빈 파일)

