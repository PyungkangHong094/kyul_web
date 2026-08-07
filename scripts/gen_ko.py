#!/usr/bin/env python3
"""EN 원본에서 <head> 메타만 한글로 치환한 *.ko.html 생성.
index.html / kyul.html 을 수정했으면 배포 전에 반드시 다시 실행할 것 (./deploy.sh 가 자동 실행).
원본 문자열이 바뀌어 못 찾으면 assert 로 시끄럽게 실패한다 — 조용한 드리프트 방지."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def build(src, dst, pairs):
    t = (ROOT / src).read_text()
    for old, new in pairs:
        assert old in t, f"{src}: 원본에서 못 찾음 → {old[:70]}"
        t = t.replace(old, new, 1)
    (ROOT / dst).write_text(t)
    print("built", dst)


build('index.html', 'index.ko.html', [
    ('<html lang="en" data-lang="en">', '<html lang="ko" data-lang="ko">'),
    ('<title>Kyul 결 — A Korean Word Puzzle That Shapes the World</title>',
     '<title>결 Kyul — 말로 세상을 빚는 한글 퍼즐</title>'),
    ('<meta name="description" content="Link Korean letters to form words — and watch each word\'s meaning come true on the board. 12 worlds, 144 puzzles, painted in ink on hanji paper." />',
     '<meta name="description" content="자모를 이어 단어를 만들면, 그 뜻대로 세상이 움직입니다. 한지 위에 수묵으로 그린 열두 세계, 백사십사 개의 마당." />'),
    ('<meta property="og:title" content="Kyul 결 — A Korean Word Puzzle That Shapes the World" />',
     '<meta property="og:title" content="결 Kyul — 말로 세상을 빚는 한글 퍼즐" />'),
    ('<meta property="og:description" content="Shape the world with words, and in the end, create the letters. An ink-wash puzzle built on the Korean alphabet." />',
     '<meta property="og:description" content="말로 세상을 빚고, 마지막에 글자를 만든다 — 한글로 그리는 수묵 단어 퍼즐." />'),
    ('<meta property="og:locale" content="en_US" />\n<meta property="og:locale:alternate" content="ko_KR" />',
     '<meta property="og:locale" content="ko_KR" />\n<meta property="og:locale:alternate" content="en_US" />'),
])

build('kyul.html', 'kyul.ko.html', [
    ('<html lang="en" data-lang="en">', '<html lang="ko" data-lang="ko">'),
    ('<title>Get Kyul 결 — Ink Word Puzzle</title>',
     '<title>결 Kyul 받기 — 수묵 한글 퍼즐</title>'),
    ('<meta name="description" content="Download Kyul — a Korean word puzzle painted in ink. Free on the App Store and Google Play." />',
     '<meta name="description" content="수묵으로 그린 한글 단어 퍼즐 「결」 — App Store · Google Play 무료 다운로드." />'),
    ('<meta property="og:title" content="Kyul 결 — an ink-wash Korean word puzzle 🖌️" />',
     '<meta property="og:title" content="결 — 말로 세상을 빚는 수묵 단어 퍼즐 🖌️" />'),
    ('<meta property="og:description" content="A puzzle game where words shape the world: link letters to awaken a word, and the board moves by its meaning — painted in ink on hanji paper." />',
     '<meta property="og:description" content="자모를 이어 단어를 깨우면, 그 뜻대로 판이 움직이는 퍼즐 게임. 한지 위에 먹으로 그린 열두 세계를 건너보세요." />'),
    ('<meta property="og:locale" content="en_US" />\n<meta property="og:locale:alternate" content="ko_KR" />',
     '<meta property="og:locale" content="ko_KR" />\n<meta property="og:locale:alternate" content="en_US" />'),
])
