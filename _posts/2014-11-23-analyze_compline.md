## 코드 분석

실제 작동 시작점은 아래부터다.

현재 탭 내용 전체를 영역으로 설정

	region = sublime.Region(0, self.view.size())


- sublime.Region(시작 지점, 끝 지점)
- self.view.size(): 전체 view

영역을 줄 단위로 나눠 줄 목록을 lines 변수에 저장

	lines = self.view.lines(region)

- self.view.lines(region): Returns a list of lines (in sorted order) intersecting the region.

target() 함수 호출하여 현재 커서가 있는 위치의 문자열을 받아 좌우 공백을 제거한다.

	target = target().strip()
	
	def target():
		line = self.view.line(self.view.sel()[0].begin())
		return self.view.substr(line)

- strip(): 파이썬 함수로 문자열의 좌우 공백 제거
- self.view.sel()은 선택영역의 (시작점, 끝점)으로 이루어진 쌍의 목록을 반환한다.
- **begin()은 시작점과 끝점의 최소값을 반환한다(int). 무슨 말일까?** 커서가 있는 행의 시작점으로 이동한다는 말인가? 찾았다. **self.view.sel()[0].begin()**은 선택영역의 시작점을 가져온다. 만약 선택 영역이 없으면 현재 커서가 위치가 시작과 끝지점이 된다. 다중 선택을 사용하려면, self.view.sel()을 반복문에서 사용한다.(This gets the start point of the current selection. if nothing is selected, start and end of selection are the current cursor position). [출처](http://stackoverflow.com/questions/12814731/how-do-i-get-the-current-caret-position)
- self.view.line(point): Returns the line that contains the point.(Region)
- self.view.substr(line): line 영역의 내용을 문자열로 반환한다.

matches는 퀵패널에 표시될 문자열을 보관하는 변수다. uniq() 함수는 taget()에서 설정한 문자열로 시작하는 문장을 반환한다.

matches = uniq([self.view.substr(line).lstrip() for line in lines if self.view.substr(line).lstrip().startswith(target)])

	def uniq(seq): 
		checked = []
		for e in seq:
			if e.strip() not in checked:
				checked.append(e)
		return checked

- lstrip() 문자열 왼쪽 공백 제거
- target() 함수에서 받은 문자열로 시작하는 문자열을 matches 변수에 할당, 그런데 **[]는 왜 붙였을까?** 리스트로 보낸다는 의미인가?
- uniq()함수는 똑같은 문장이 포함되지 않게하는 기능

서블라임의 퀵패널에 matches를 표시하고, 사용자가 선택을 하면 foo를 실행한다.

	sublime.active_window().show_quick_panel(matches, foo)

- show_quick_panel(퀵패널에 표시할 것, 선택한 뒤에 할 일(, 폰트)): 취소되면 -1을 반환한다.

퀵패널에 표시되는 문장을 담은 변수 matches와 선택한 이후에 실행될 foo 함수가 정해졌다. foo 함수를 이해하기 위해선 단어를 문장으로 바꾸는 역할을 하는 ComplineComplete 클래스를 먼저 이해하는 것이 좋겠다.

### ComplineComplete class 분석

	def run(self, edit, matches, begin, i, index):
		self.view.replace(edit, sublime.Region(begin, self.view.sel()[i].end()), matches[index])

- replace(edit, region, string): Replaces the contents of the region with the given string.

네 개의 인자를 받는다. matches는 퀵패널에 표시되는 문장 리스트, index는 matches의 인덱스, begin은 선택영역의 시작 위치, **i**는 선택 리스트의 요소. sublime.Region(begin, self.view.sel()[i].end())은 입력한 키워드의 시작지점부터 끝지점을 알려주는 argument이다. 이 영역이 문장으로 대치된다.

### foo 함수 분석

	def foo(index):
			if(index > -1):

index는 퀵패널에 표시된 문자열의 순서 번호. 퀵패널을 취소하면 -1이 반환되기 때문에 -1 이상이어야 한다. 퀵패널에서 선택을 하면, 보통 on_done 이란 이름의 함수로 정의한다.

여기서부터는 입력한 단어를 문장으로 대치할 때, 단어의 시작점과 끝점을 지정하기 위해서 작성한 것 같다.

	for i in range(len(self.view.sel())):

커서가 위치한 곳을 루프로 돌린다. self.view.sel()이 다중선택이 가능하기 때문에 이렇게 하는 것 같다. 하지만 지금은 한 단어만 입력하기 때문에 range는 [0:1]일 듯하다.

		line = self.view.line(self.view.sel()[i].begin())
		src = self.view.substr(line)

self.view.sel()[i].begin()은 입력된 단어끝 위치이다. line변수에 커서가 있는 줄 위치를 저장하고, src 변수에 커서가 있는 줄의 단어를 저장한다.

		match = re.search(r"$", src)

커서가 위치한 줄의 우측 끝위치를 찾아 그 값을 match 변수에 저장한다. **re.search(pattern, string)**는 string에서 pattern이 존재하는지 검사한 후 있으면 MatchObject를, 없으면 None을 반환한다. patter에서 "r"은 raw string으로서 '\'을 escape 문자로 생각하지 말고 문자 그대로 '\'로 해석하라는 뜻이다. 항상 이 형식으로 쓰는 게 좋다.

		if(match):
			end = match.end()

검색 성공하면 우측 끝지점을 end 변수에 저장한다.

			match = re.search(r"\S", src)

커서가 위치한 줄의 단어에서 공백 이외의 문자 찾는다.(앞쪽부터 검색)

			if(match):
				start = match.start()

그 문자의 위치를 시작점으로 잡는다.

			else:
				start = self.view.sel()[i].begin()
				end = line.end()

공백 이외의 문자가 없으면 커서 위치를 start 변수에, 줄의 끝을 end 변수에 저장한다.

			length = end - start
			begin = self.view.sel()[i].begin()-length

끝위치에서 시작위치를 빼면 입력한 단어의 길이를 알 수 있다. 입력한 단어의 길이를 알아야 문장으로 대치할 수 있기 때문이다. 예를 들어, "키워드"라고 입력하면 .begin()의 위치는 "드" 뒤이다. length는 "키"앞에서 "드"뒤까지이다. begin 변수는 키워드를 문장으로 대치할 때 입력 위치이다. "키" 바로 앞 위치가 입력되어 있어야 정확히 대치된다.

			self.view.run_command("compline_complete",{"matches": matches, "i": i, "begin": begin, "index": index})

## re module

re is python regular expression module

re.match() and re.search()

- 일치하는 문자열을 찾지 못하면 None 반환
- 발견하면 MatchObject 반환

group(): 일치된 문자열 반환
start(): 일치된 문자열 시작위치 반환
end(): 일치된 문자열 끝위치 반환
span(): 일치 위치를 (start, end) 터플로 반환

팝업 창 크기에 따라 한 번에 표시되는 분량이 달라진다. 창 크기보다 표시할 글자의 양이 많으면 일부 글자가 ...으로 표시되어 내용을 알 수 없다. **일치된 문자열의 처음 위치에서 60자 정도 화면에 나타나도록 코딩하면 어떨까?** 

- view.sel(): Returns a reference to the selection. 현재 선택된 텍스트 영역을 리스트로 돌려준다.
- view.line(region): Returns a modified copy of region such that it starts at the beginning of a line, and ends at the end of a line. Note that it may span several lines.
- Region.begin(): Returns the minimum of a and b
- for regin in view.sel(): 이라고 하면 다중 선택까지 고려해 선택된 모든 텍스트를 대상으로 뺑뺑이 돌며 작업하겠다는 뜻
- view.substr(region): 선택한 텍스트를 얻을 수 있다.


- object.run_command('command_name'). In addition, you can pass a dictionary where keys are names of parameters to command_name.


## 단어 선택

- **view.sel()** returns the list of those cursors. The first element of the list refers to the current cursor position.
- **view.word()** returns the region of the current word.
- **view.replace()** replaces the selected word with the given text. edit is the buffer currently in use.

	cursor = self.view.sel()[0]
	word_region = self.view.word(cursor)
	word = self.view.substr(word_region) 
	self.view.replace(edit, word_region, args['text'])

### show_popup_menu callback method 

if the use canceled out of the popout menu, -1 is returned. Otherwise the index is returned.

		if index == -1: return

