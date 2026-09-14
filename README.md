# GoldenDusk.log

> "노을처럼 은은하게, 기록은 오래도록."

Velog, GitBook, 네이버 블로그의 글을 하나로 모은 개인 통합 블로그입니다.

**Live** : https://goldendusk-blog.vercel.app

## Features

- **통합 블로그** - Velog(160), GitBook(142), Naver(50) 총 352개 포스트를 하나의 SPA에서 탐색
- **카테고리 서랍장** - 개발 / 기록 / 일상 등 35개 카테고리, 색상별 배지
- **글 상세 패널** - 마크다운 렌더링, 목차, 읽기 시간 추정, 원문 링크
- **타임라인** - 연도별 회고록 연결 (나의 일대기)
- **자동 싱크** - GitHub Actions cron (6시간마다) Velog + Naver 새 글 동기화
- **다크 모드** - 시스템 / 수동 전환 지원
- **반응형** - 모바일 ~ 데스크톱

## Tech Stack

| 항목 | 기술 |
|------|------|
| Frontend | Vanilla HTML/CSS/JS (SPA), marked.js |
| Hosting | Vercel |
| Data | `posts-meta.json` + `content/*.md` (정적 파일) |
| Sync | Node.js 스크립트 (`sync-velog.mjs`, `sync-naver.mjs`) |
| CI | GitHub Actions (`sync-posts.yml`, 6시간 cron) |

## Project Structure

```
goldendusk-blog/
├── index.html          # SPA 메인 (HTML + CSS + JS 올인원)
├── posts-meta.json     # 전체 포스트 메타데이터
├── content/            # 마크다운 콘텐츠 (1.md ~ 351.md)
├── hero-illust.png     # 히어로 일러스트
├── vercel.json         # Vercel 배포 설정
├── scripts/
│   ├── sync-velog.mjs  # Velog GraphQL → 마크다운 동기화
│   └── sync-naver.mjs  # 네이버 블로그 RSS/크롤링 동기화
└── .github/workflows/
    └── sync-posts.yml  # 자동 싱크 워크플로우
```

## Local Development

```bash
npx serve . -l 3456
```

http://localhost:3456 에서 확인

## Sync Scripts

```bash
# Velog 새 글 동기화
node scripts/sync-velog.mjs

# 네이버 블로그 새 글 동기화
node scripts/sync-naver.mjs
```

## Deploy

GitHub `master` 브랜치에 push하면 Vercel이 자동 배포합니다.

수동 배포:
```bash
npx vercel --prod
```

## Author

**GoldenDusk** - Better Code, A Brighter Me
