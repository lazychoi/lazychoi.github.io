---
layout: post
title:  "Writing Sublime Plugins 요약 2"
date:   2014-11-20
categories: Computer
tags : [Sublime text, plugin]
---

### 9장 Hello World, event listener edition

앞서 배운 지식을 토대로 코드를 작성해 보자.

메뉴에서 Tools > New Plugin...을 선택하면 아래와 같은 코드가 입력된 탭이 열린다.

	import sublime, sublime_plugin

	class ExampleCommand(sublime_plugin.TextCommand):

		def run(self, edit):
			self.view.insert(edit, 0, "Hello, World!")

먼저 클래스 선언을 바꾼다. TextCommand와 달리 클래스 이름 끝에 Command를 붙일 필요 없다. 
	
	class KeyBindingListener(sublime_plugin.EventListener):

run 메서드를 삭제하고 다음으로 교체한다.

	def on_window_command(self, window, name, args):
		print("The window command name is: " + name)
		print("The args are: " + str(args))

위와 같이 on_window_command를 정의하는 이유는 WindowCommand가 실행될 때마다 통보를 받기 위해서다. **WindowCommand**는 layout panes(??)과 탭 그룹을 열고 닫거나 새 탭을 열고 탭 간에 전환하는 작업을 할 때 이용한다.

on_window_command에는 네 개의 arguments를 받아들인다.
- self: KeyBindingListener의 인스턴스를 가리킴
- window: 현재 활성화된 창을 가리킴
- name: 실행 중인 명령어 이름
- args: command가 받아들일 인자 목록

print("The window command name is: " + name)는 콘솔에 현재 실행 중인 명령어 이름을 표시한다.

print("The args are: " + str(args))는 명령어가 실행되면 받게 되는 인자 목록을 콘솔에 표시한다.




