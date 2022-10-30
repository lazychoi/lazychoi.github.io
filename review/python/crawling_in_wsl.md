---
title: 크롤링 in wsl
date: 2022-10-12
---

- [설치 및 환경설정 참고 사이트(영문)](https://cloudbytes.dev/snippets/run-selenium-and-chrome-on-wsl2#creating-a-script-to-automate-the-process){target=_blank}

- [주피터 노트북에서 selenium 사용(영문)](https://cloudbytes.dev/snippets/run-selenium-in-jupyter-notebook-on-wsl2-or-ubuntu){target=_blank}

## selenium

### selenium 설치

`$ pip install selenium`

?? 주피터 노트북에서 임포트할 경우 에러 발생
vscode에서는 잘 됨

### chrome 설치, webdriver  다운로드

`$ pip install chromedriver_autoinstaller`

wsl에 크롬 설치

```bash
sudo apt update && sudo apt -y upgrade && sudo apt -y autoremove
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt -y install ./google-chrome-stable_current_amd64.deb
google-chrome --version
```

webdriver 다운로드

```bash
sudo wget https://chromedriver.storage.googleapis.com/106.0.5249.61/chromedriver_linux64.zip
sudo apt install unzip # unzip 설치
unzip chromedriver_linux64.zip
```

## 오류

DeprecationWarning: executable_path has been deprecated, please pass in a Service object
  driver = webdriver.Chrome('./chromedriver')

또는

(unknown error: DevToolsActivePort file doesn't exist)

같은 여러 가지 오류를 모두 잡은 코드

`$ pip install webdriver-manager`

```python
from selenium import webdriver 
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = webdriver.ChromeOptions()
options.add_argument("no-sandbox")
options.add_argument("--disable-extensions")
options.add_argument("--headless")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
driver.get("https://www.google.com")
print(driver.title)
```

## 제한 사항

==wsl에서는 크롬 브라우저가 뜨지 않는다.==

반환값을 확인하며 코드를 작성해야 한다.

## 기억할 사항

selenium은 `driver.page_source` 명령으로 소스 코드를 동적으로 불러올 수 있다. 즉, 버튼을 클릭하거나 스크롤하면 소스 코드가 계속 추가된다.
