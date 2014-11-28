# 파이썬 정규표현식

## 문법

**character set, []**

- [a-zA-Z0-9] = \w
- [0-9] = \d
- []안에 사용된 ^ = not
- [ \t\n\r\f\v] = \s : whitespace
- \W = not \w
- \D = not \d
- \S = not \s
- dot(.) : \n을 제외한 모든 문자
- []안에 사용된 dot(.)은 문자 그대로의 . 의미
- {m, n} : m번부터 n번까지 반복
- {1, } = +
- {0, } = *
- {0, 1} = ?

## 파이썬 정규표현식 모듈 re

	import re
	p = re.compile('ab*')
	p = re.compile('ab*', re.IGNORECASE)
	p = re.compile(r'\\section')

re.IGNORECASE : 대소문자 구분하지 않음
r : **Raw string** 백슬래시(\)를 메타문자가 아닌 문자 그대로 해석

### 정규식 검색

**match() : 문자열의 처음부터 검사**
**search() : 문자열 전체 검사**

원하는 결과를 찾았을 때는 match object을 리턴하고, 찾지 못했을 때는 None 리턴

	import re
	p = re.compile('[a-z]+')
	m = p.match('python')
	print(m)
	n = p.match('3 python')
	print(n)

match는 문자열 앞에서부터 검색하기 때문에 print(m)은 object 리턴, print(n)은 None 리턴

**다음 코드는 많이 사용되기 때문에 숙지할 것**

	p = re.compile(.....)
	m = p.match('string goes here')
	if m:
		print('Match found: ', m.group())
	else:
		print('No match')

위 코드에서 match를 search로 바꾸면 문자열 전체에서 검색하기 때문에 print(m), print(n) 모두 object 리턴한다.

**findall() : 정규식과 매치되는 모든 문자열을 리스트로 리턴**
**finditer() : 정규식과 매치되는 모든 문자열을 iterator 객체로 리턴**

	result = p.findall("life is too short")
	print(result)

결과는 이렇다. ['life', 'is', 'too', 'short']

#### match object

리턴된 문자열의 내용과 인덱스를 아는 방법

- group() : 매치된 문자열을 리턴
- start() : 매치된 문자열의 시작 위치를 리턴
- end() : 매치된 문자열의 끝 위치를 리턴
- span() : 매치된 문자열의 (시작, 끝)에 해당되는 튜플을 리턴

	>>> m = p.match("python")
	>>> m.group()
	'python'
	>>> m.start()
	0
	>>> m.end()
	6
	>>> m.span()
	(0, 6)

이번엔 search()

	>>> m = p.search("3 python")
	>>> m.group()
	'python'
	>>> m.start()
	2
	>>> m.end()
	8
	>>> m.span()
	(2, 8)

#### 모듈 단위로 수행하기

	m = re.match('[a-z]+', "python")

## 예제

**주민등록번호**

(\d{6})[-](\d{7})

앞자리 숫자(\d) 6자리. 가운데 - 기호, 뒷자리 숫자(\d) 7자리

