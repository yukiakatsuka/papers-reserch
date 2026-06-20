# PaperSwipe

PaperSwipe is an iPhone-first PWA for swiping through free daily research papers.

## Features

- Tinder-style swipe deck for research papers
- Right swipe / Save
- Left swipe / Not interested
- Paper title and URL always visible
- Genres: AI, economics, investing, drug discovery, medicine, statistics
- Daily free harvest with local one-day cache
- OpenAlex live fetch with Crossref real-data fallback
- No demo or fake-paper fallback
- Only article and preprint records are shown
- Manual refresh when you want to retry today's harvest
- PWA support for iPhone home screen

## Local Development

```bash
pnpm install
pnpm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

In GitHub, enable Pages with:

```text
Settings -> Pages -> Build and deployment -> Source: GitHub Actions
```

After the workflow runs, open the Pages URL in iPhone Safari and choose:

```text
Share -> Add to Home Screen
```
