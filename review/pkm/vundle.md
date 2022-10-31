---
title: VI Vundle
date: 2022-10-17
---

[Vundle 홈페이지](https://github.com/VundleVim/Vundle.vim){target=_blank}

## Vundle 설치

`git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim`

## 설정: 아래 코드를 `.vimrc` 파일의 맨 위에 추가한다

```text
set nocompatible              " be iMproved, required
filetype off                  " required

" set the runtime path to include Vundle and initialize
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
" alternatively, pass a path where Vundle should install plugins
"call vundle#begin('~/some/path/here')

" let Vundle manage Vundle, required
Plugin 'VundleVim/Vundle.vim'

" The following are examples of different formats supported.
" Keep Plugin commands between vundle#begin/end.
" plugin on GitHub repo
Plugin 'tpope/vim-fugitive'
" plugin from http://vim-scripts.org/vim/scripts.html
" Plugin 'L9'
" Git plugin not hosted on GitHub
Plugin 'git://git.wincent.com/command-t.git'
" git repos on your local machine (i.e. when working on your own plugin)
Plugin 'file:///home/playdata/path/to/plugin'
" The sparkup vim script is in a subdirectory of this repo called vim.
" Pass the path to set the runtimepath properly.
Plugin 'rstacruz/sparkup', {'rtp': 'vim/'}
" Install L9 and avoid a Naming conflict if you've already installed a
" different version somewhere else.
" Plugin 'ascenator/L9', {'name': 'newL9'}

" All of your Plugins must be added before the following line
call vundle#end()            " required
filetype plugin indent on    " required
" To ignore plugin indent changes, instead use:
"filetype plugin on
"
" Brief help
" :PluginList       - lists configured plugins
" :PluginInstall    - installs plugins; append `!` to update or just :PluginUpdate
" :PluginSearch foo - searches for foo; append `!` to refresh local cache
" :PluginClean      - confirms removal of unused plugins; append `!` to auto-approve removal
"
" see :h vundle for more details or wiki for FAQ
" Put your non-Plugin stuff after this line
```

call vundle#begin()과 call vundle#end() 사이에 설치할 Plugin을 지정한다.

## 플러그인 설치: vim 실행 후 `:PluginInstall`

에러 발생: Plugin 'file:///home/playdata/path/to/plugin'

## 추가한 플러그인

- nerdtree: .vimrc의 플러그인 정의 영역에 Plugin 'scrooloose/nerdtree' 추가 -> 단축키 설정(.vimrc에 추가) nmap nerd :NERDTreeToggle<CR> -> vi 명령모드에서 'nerd'를 키보드로 치면 실행됨
