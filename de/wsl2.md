---
title: wsl2
date: 2022-10-14
---

[설치 설명서(영문)](https://towardsdatascience.com/configuring-jupyter-notebook-in-windows-subsystem-linux-wsl2-c757893e9d69){target=_blank}

wsl에서 윈도우 파일에 접근:

- `/mnt`에 마운트되어 있음 >>> `$ cd /mnt/c` 명령으로 이동 
- `$ explorer .` 명령으로 윈도우 탐색기를 열어 GUI 화면으로 사용

wsl 저장 위치:

- `C:\Users\사용자명\AppData\Local\Packages\` 폴더 >>> `CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\` 처럼 ubuntu 단어가 포함된 폴더 >>> `LocalState` 안
- `ext4.vhdx`라는 이미지 파일로 저장되어 있음

anaconda 설치

jupyter notebook 설정

```bash
$ jupyter notebook --generate-config
Writing default config to: /home/playdata/.jupyter/jupyter_notebook_config.py
$ cd .jupyter
$ vi jupyter_notebook_config.py
```

`# c.NotebookApp.open_browser = False` <-- 주석 삭제 후 False로 변경
