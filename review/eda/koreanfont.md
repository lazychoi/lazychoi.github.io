---
title: 한글이 보이지 않을 때
date: 2022/11/11
date-modified: last-modified
format: 
  html:
    code-fold: false
---

```python
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "NanumBarunGothic"
plt.rcParams['axes.unicode_minus'] = False
```

위와 같이 설정을 하고 나눔바른고딕 폰트(NanumBarunGothic.ttf)를 설치했는데도 폰트를 찾지 못하는 경우가 있다. matplotlib이 새로 설치한 폰트를 반영하지 못하기 때문이다. 이럴 때는 아래 방법을 사용한다.

1. 아래 명령어로 matplotlib의 설정 파일을 찾는다.

```python
import matplotlib
matplotlib.matplotlib_fname()
```

내 맥은 아래 경로다

/opt/homebrew/anaconda3/lib/python3.9/site-packages/matplotlib/mpl-data/matplotlibrc

vi 에디터로 열어 sans-serif를 NanumBarunGothic으로 바꾼다.

```python
#font.family : sans-serif
```

2. /opt/homebrew/anaconda3/lib/python3.9/site-packages/matplotlib/mpl-data/fonts/ttf/ 폴더에 NanumBarunGothic.ttf 파일을 복사한다.

이상하게도 파인더에서 위 폴더를 찾을 수 없다. 그래서 터미널을 이용해서 폰트 파일을 복사했다.

3. 아래 명령어로 캐시 폴더를 찾아 그 안에 있는 모든 파일을 삭제한다.

matplotlib.get_cachedir()

내 맥은 /Users/jun/.matplotlib 여기가 캐시 폴더다.

4. 주피터 노트북을 재시작한다.

[출처](https://seong6496.tistory.com/95){target=_blank}