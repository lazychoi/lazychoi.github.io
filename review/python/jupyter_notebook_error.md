---
title: 주피터 노트북이 두 개 설치되어 발생하는 오류 해결
date: 2022-10-17
---

jupyter nbconvert --to markdown 06court_sort.ipynb

주피터 노트북 파일을 마크다운 파일로 변환할 때 쓰는 nbconvert를 실행할 때 아나콘다 내의 파이썬이 실행되지 않고 우분투 내의 파이썬이 실행되어 오류를 내뿜는다. 그래서 우분투 내의 파이썬 삭제. 참조한 사이트는 [여기](https://gist.github.com/zhensongren/811dcf2471f663ed3148a272f1faa957){target=_blank}다. 

우분투에 깔린 파이썬을 삭제하면 아나콘다 버전이 사용될 줄 알았는데, -bash: /home/playdata/.local/bin/jupyter: /usr/bin/python3: bad interpreter: No such file or directory 요렇게 파이썬 인터프리터가 없다는 메시지가 나온다. 그러면 주피터도 아나콘다 버전이 아닌 우분투 자체에 설치된 것이 사용되는가 싶어 주피터 위치를 확인해 보았다.

```bash
> which -a jupyter
/home/playdata/.local/bin/jupyter
/home/playdata/anaconda3/bin/jupyter
```

역시나 두 군데 깔려있다. local에 설치된 주피터를 삭제(sudo rm -rf /home/playdata/.local/bin/jupyter)하니 아나콘다에 깔린 주피터가 실행되긴 한다. 하지만 또 다시 에러

ImportError: cannot import name 'contextfilter' from 'jinja2'

이래저래 안 돼 conda 명령어로 주피터를 재설치하니 성공 conda install jupyter

주피터도 한 개만 나온다.

```bash
> which -a jupyter
/home/playdata/anaconda3/bin/jupyter
```
