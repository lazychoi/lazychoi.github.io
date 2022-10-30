---
title: gitignore가 적용 안 될 때
date: 2022-10-09
---

문제 상황: `.gitignore` 파일에 기록했는데도 Untracted files로 보이는 경우

원인: 캐시

해결: 캐시를 삭제한다. `$ git rm -r --cached .`
