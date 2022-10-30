---
title: vscode extension
date: 2022-10-12
---

## Paste Image

- 캡처한 이미지를 문서에 붙여넣을 때 경로와 파일명 자동 작성됨.  
- 일반 붙여넣기 단축키 말고 vscode 안에서 설정한 단축키로 붙여넣어야 한다.

설정 방법:

1. Paste Image: Base Path -> **문서 파일에 입력할 경로** -> 이미지가 저장된 위치를 현재 파일 기준으로 상대경로로 입력하려면 `${currentFileDir}`를 입력하고, 프로젝트 루트부터 절대경로로 입력하려면 `${projectRoot}`를 입력한다.
2. Paste Image: Path -> **이미지 파일이 저장될 위치 ** -> 모든 이미지를 한 폴더 저장하려면 `${projectRoot}/docs/images`처럼 프로젝트 루트부터 경로를 입력한다. 현재 문서 파일과 같은 위치에 이미지 파일을 저장하려면 `${currentFileDir}`를 입력하고, 현재 문서 파일 아래에 images 폴더를 만들어 저장하려면 `${currentFileDir}/images`를 입력한다.

![Base Path](../../images/2022-10-22-12-57-02.png)
![Path](../../images/2022-10-22-12-57-45.png)

### [오류] wsl2에서 xclip 미설치 오류 나타남

- xclip 클론하고 그 폴더를 PATH에 포함

```bash
> cd ~/bin
> git clone https://github.com/Konfekt/win-bash-xclip-xsel
> cp xclip ~/bin
```

### [오류] wsl2에서 저장된 파일 크기 0KB
