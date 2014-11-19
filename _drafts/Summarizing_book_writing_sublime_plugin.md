### 7장 구현 방법 개관

1. 플러그인의 목적: 키보드 단축키를 누를 때 실행되는 명령어 이름을 서블라임의 상태막대에 표시
2. 필요한 작업을 간단히 훑어보면,
	1. 사용자가 키보드를 누를 때마다 반응하는 방법이 필요하다. **event listener**를 이용한다.
	2. 명령어 이름을 얻는 방법
		1. sublime 어딘가에 단축키와 명령어 이름이 정리된 파일이 있지 않을까?
		2. sublime의 명령어 로그(명령어 이름을 콘솔에 기록)를 이용하는 방법
		3. sublime의 명령어 히스토리의 마지막 항목을 가져오는 방법
	3. convert command name from snake cast to user format
	4. toggle plugin on and off

### 8장 event listener 의미

sublime_plugin.EventListener class

클래스 이름은 자유롭게 해도 됨.

