---
title: "DOM을 깨우치다"
listing:
  contents: dom_enlightenment
  sort: "title"
  type: default
---

**DOM의 목적**은 JavaScript를 사용해서 이 문서에 대한 스크립트 작성(삭제, 추가, 바꾸기, 이벤트 처리, 수정)을 위한 프로그래밍 인터페이스를 제공하는 것이다.

## 노드 개체 유형 출력

```javascript
for(let key in Node){
    console.log(key + ' = ' + Node[key]);
};
/* 결과
ELEMENT_NODE = 1
ATTRIBUTE_NODE = 2
TEXT_NODE = 3
CDATA_SECTION_NODE = 4
ENTITY_REFERENCE_NODE = 5
ENTITY_NODE = 6
PROCESSING_INSTRUCTION_NODE = 7
COMMENT_NODE = 8
DOCUMENT_NODE = 9
DOCUMENT_TYPE_NODE = 10
DOCUMENT_FRAGMENT_NODE = 11
NOTATION_NODE = 12
DOCUMENT_POSITION_DISCONNECTED = 1
DOCUMENT_POSITION_PRECEDING = 2
DOCUMENT_POSITION_FOLLOWING = 4
DOCUMENT_POSITION_CONTAINS = 8
DOCUMENT_POSITION_CONTAINED_BY = 16
DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32
*/
```

모든 노드는 Node로부터 상속받는 nodeType 및 nodeName 속성을 가진다. Text 노드의 nodeTyep 코드는 3이며, nodeName 값은 #text이다.

노드 유형을 판별하는 가장 빠른 방법은 nodeType 속성을 확인하는 것이다. 노드 유형을 판별하는 것은 해당 노드에서 사용 가능한 속성과 메서드를 알 수 있게 하므로 매우 유용하다.

nodeValue 속성은 Text와 Comment를 제외한 대부분 노드 유형에서 null값을 반환한다. 이 속성의 용도는 Text와 Comment 노드에서 텍스트 문자열을 추출하는 데 초점을 맞추고 있다.

```html
<a href="#">Hi</a>
<script>console.log(document.querySelector('a').firstChild.nodeValue);</script>
<!-- Hi 출력 -->
```

## 메서드 사용하여 노드 생성 : createElement(), createTextNode()

```javascript
let body = document.body;   // <body>​</body>​
let textNode = document.createTextNode('Hi');
body.appendChild(textNode); // <body>​Hi</body>

let divA = document.createElement('div'); 
divA.innerHTML = "<strong>Hello</strong>"; // <strong>Hello</strong>
body.appendChild(divA); // <div><strong>Hello</strong></div>
```

## 문자열 사용하여 노드 생성 : innerHTML, outerHTML, textContext, insertAdjacentHTML()

outerHTML : 기존 노드를 지정한 노드로 대체 -> 문자열 내의 HTML 요소를 실제 DOM 노드로 변환

```javascript
divA.outerHTML = '<h2>안녕하세요</h2>'; // <div><strong>Hello</strong></div> => <h2>안녕하세요</h2>
```

textContent -> 실제 DOM 노드로 변환되지 않고 텍스트 노드를 생성하는 데만 사용됨. `<script>`, `<style>` 요소를 포함한 모든 요소의 내용을 가져올 수 있지만 innerText는 그렇지 않다.

```javascript
divA.textContent; // 'Hello' <- 이전 텍스트가 반환됨(html에는 보이지 않음)
divA.textContent = '2023년 새해입니다'; // textContents 바꿈 '2023년 새해입니다'(html에는 보이지 않음)
```

insertAdjacentHTML() : Element 노드에서만 동작. 시작 태그 앞/뒤, 종료 태그 앞/뒤에 노드 삽입 가능

```javascript
body.appendChild(divA);    // <div>​2023년 새해입니다​</div>​
divA.insertAdjacentHTML('beforebegin', '<span>오늘은 </span>');  // <span>오늘은 </span><div>​2023년 새해입니다​</div>​
divA.insertAdjacentHTML('afterbegin', '<span>1월 1일</span>');   // <span>오늘은 </span><div>​<span>1월 1일</span>​2023년 새해입니다​</div>​
divA.insertAdjacentHTML('beforeend', '<span> 해돋이를</span>');  // <span>오늘은 </span><div>​<span>1월 1일</span>​2023년 새해입니다​<span> 해돋이를</span></div>
divA.insertAdjacentHTML('afterend', '<span>봤나요?</span>');    // // <span>오늘은 </span><div>​<span>1월 1일</span>​2023년 새해입니다​<span> 해돋이를</span></div><span>봤나요?</span>
```

`innerAjacentHTML`의 beforebegin, afterend 옵션은 노드가 DOM 트리 내에 존재하고 부모 요소를 가진 경우에만 동작한다. `outerText`도 부모 요소를 가진 경우에만 동작한다.

## DOM 트리 일부를 문자열로 추출 : innerHTML, outerHTML, textContent, innerText, outerText

```HTML
<div id="a"><i>안녕</i></div>
<div id="b">여러분 <strong>반가워</strong></div>
<script>
  console.log(document.getElementById('a').innerHTML);    // <i>안녕</i>
  console.log(document.getElementById('a').outerHTML);    // <div id="a"><i>안녕</i></div>
  console.log(document.getElementById('b').textContent);  // 여러분 반가워
  console.log(document.getElementById('b').innerText);    // 여러분 반가워
  console.log(document.getElementById('b').outerText);    // 여러분 반가워
</script>
```

## 노드 개체를 DOM에 추가 : appendChild(), insertBefore()

- appendChild() : 매개변수로 받은 노드를 자식 노드의 끝에 추가 = `append()`

```HTML
<p>안녕</p>
<script>
  let elementNode = document.createElement('strong');
  let textNode = document.createTextNode(' Dude');

  document.querySelector('p').appendChild(elementNode);
  document.querySelector('strong').appendChild(textNode);

  console.log(document.body.innerHTML); // <p>안녕<strong> Dude</strong></p>
</script>
```

- insertBefore() : 매개변수로 받은 노드를 자식 노드의 맨 앞에 추가 = `prepend()`

```HTML
<ul>
  <li>2</li>
  <li>3</li>
</ul>
<script>
  let elementNode = document.createElement('li');
  let textNode = document.createTextNode('1');
  elementNode.appendChild(textNode);  // <li>1</li>

  let ul = document.querySelector('ul');
  ul.insertBefore(elementNode, ul.firstChild);
  console.log(document.body.innerHTML);
  // <ul>
  //   <li>1</li>
  //   <li>2</li>
  //   <li>3</li>
  // </ul>
</script>
```

- before() = insertAdjacentHTML-'beforebegin'
- after() = insertAdjacentHTML-'afterend'
- prepend() = insertAdjacentHTML-'afterbegin'
- append() = insertAdjacentHTML-'afterend'



## 이해 안 된 문장

- 기본적으로 writh() 메서드는 전달된 값을 페이지가 로딩 및 해석되는 동안 페이지에 출력한다. writh() 메서드를 사용하면 로딩된 HTML 문서가 해석되는 것을 지연/차단하게 된다는 것에 유의
- innerHTML이 무겁고 비싼 대가를 치르는 HTML 파서를 호출하는 데 비해 텍스트 노드 생성은 간단히 처리되므로 innerHTML 계열의 사용을 삼가해야 한다.

