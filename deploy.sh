#!/bin/sh
# 배포 — 한글 메타 버전(*.ko.html) 재생성 후 Vercel 프로덕션 배포
set -e
cd "$(dirname "$0")"
python3 scripts/gen_ko.py
vercel deploy --prod --yes
