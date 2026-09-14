import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BLOG_ID = 'prettylee620';
const RSS_URL = `https://rss.blog.naver.com/${BLOG_ID}`;
const ROOT = join(import.meta.dirname, '..');
const META_PATH = join(ROOT, 'posts-meta.json');
const CONTENT_DIR = join(ROOT, 'content');

const NAVER_CAT_MAP = {
  '맛집일기': '맛집',
  '간식로그': '간식',
  '연극/뮤지컬/공연': '문화생활',
  '카페로그': '카페',
  '여행기록': '여행',
  '일상': '일상',
};

const CAT_ICONS = {
  '맛집': '🍽️',
  '간식': '🍰',
  '문화생활': '🎭',
  '카페': '☕',
  '여행': '✈️',
  '일상': '🌿',
};

function mapCategory(navCat) {
  return NAVER_CAT_MAP[navCat] || '일상';
}

async function fetchRSS() {
  const res = await fetch(RSS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoldenDuskBot/1.0)' },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  return res.text();
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`));
      return m ? m[1].trim() : '';
    };
    const link = get('link');
    const guidMatch = link.match(/\/(\d+)/);
    const desc = get('description');
    const thumbMatch = desc.match(/<img\s+src="([^"]+)"/);
    items.push({
      title: get('title'),
      link,
      postId: guidMatch ? guidMatch[1] : '',
      category: get('category'),
      pubDate: get('pubDate'),
      description: desc.replace(/<[^>]+>/g, '').slice(0, 200),
      thumb: thumbMatch ? thumbMatch[1].replace(/\?type=\w+/, '?type=s3').replace(/mblogthumb-phinf\.pstatic\.net/g, 'blogthumb.pstatic.net') : '',
    });
  }
  return items;
}

async function fetchPostBody(postId) {
  const url = `https://m.blog.naver.com/${BLOG_ID}/${postId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    },
  });
  if (!res.ok) return '';
  const html = await res.text();
  return htmlToMarkdown(html);
}

function cleanText(h) {
  return h
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

function fixImgUrl(url) {
  return url.replace(/\?type=\w+/, '?type=s3').replace(/mblogthumb-phinf\.pstatic\.net/g, 'blogthumb.pstatic.net');
}

function parseTable(tableHtml) {
  const rows = [];
  for (const rm of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
      cells.push(cleanText(cm[1]));
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';
  const cols = Math.max(...rows.map(r => r.length));
  const widths = Array(cols).fill(3);
  rows.forEach(r => r.forEach((c, i) => { widths[i] = Math.max(widths[i], c.length); }));
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
  const mdRows = rows.map(r => '| ' + Array.from({length: cols}, (_, i) => pad(r[i] || '', widths[i])).join(' | ') + ' |');
  const sep = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  mdRows.splice(1, 0, sep);
  return mdRows.join('\n');
}

function htmlToMarkdown(html) {
  const containerMatch = html.match(/<div class="se-main-container">([\s\S]*?)<\/div>\s*<!-- _BLOG_CONTENTS_FOOTER/);
  const content = containerMatch ? containerMatch[1] : html;

  const lines = [];
  const partRegex = /<p class="se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>|<img[^>]+class="se-image-resource"[^>]*>|<div class="se-(?:hr|horizontalLine)"><\/div>|<table[^>]*>([\s\S]*?)<\/table>/g;
  let m;
  while ((m = partRegex.exec(content)) !== null) {
    if (m[0].includes('se-hr') || m[0].includes('se-horizontalLine')) {
      lines.push('\n---\n');
    } else if (m[0].startsWith('<table')) {
      const md = parseTable(m[0]);
      if (md) lines.push(md);
    } else if (m[0].includes('se-image-resource')) {
      const srcMatch = m[0].match(/data-lazy-src="([^"]+)"|src="([^"]+)"/);
      if (srcMatch) lines.push(`\n![](${fixImgUrl(srcMatch[1] || srcMatch[2])})\n`);
    } else if (m[1]) {
      const isHeading = /se-fs-fs(?:1[8-9]|[2-9]\d)/.test(m[0]);
      let text = cleanText(m[1]);
      if (text) lines.push(isHeading ? `### ${text.replace(/^\*\*|\*\*$/g, '')}` : text);
    }
  }

  return lines.join('\n\n') || '(본문을 가져올 수 없습니다)';
}

async function main() {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
  const existingNaverIds = new Set(
    meta.filter(p => p.source === 'naver').map(p => p.slug)
  );
  let nextId = Math.max(...meta.map(p => p.id)) + 1;

  console.log(`Existing: ${meta.length} posts (${existingNaverIds.size} from Naver)`);

  const rssXml = await fetchRSS();
  const rssItems = parseRSSItems(rssXml);
  console.log(`Found ${rssItems.length} in Naver RSS`);

  const newItems = rssItems.filter(item => item.postId && !existingNaverIds.has(item.postId));
  if (!newItems.length) {
    console.log('No new Naver posts');
    return;
  }

  console.log(`Syncing ${newItems.length} new Naver posts...`);

  for (const item of newItems) {
    const cat = mapCategory(item.category);
    const body = await fetchPostBody(item.postId);
    const id = nextId++;
    const date = item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : '';

    meta.push({
      id,
      title: item.title,
      date,
      cat,
      icon: CAT_ICONS[cat] || '🌿',
      source: 'naver',
      slug: item.postId,
      thumb: item.thumb || '',
      url: `https://blog.naver.com/${BLOG_ID}/${item.postId}`,
      preview: item.description.slice(0, 200),
    });

    writeFileSync(join(CONTENT_DIR, `${id}.md`), body, 'utf8');
    console.log(`  + [${id}] ${item.title}`);
    await new Promise(r => setTimeout(r, 500));
  }

  writeFileSync(META_PATH, JSON.stringify(meta), 'utf8');
  console.log(`Done: ${meta.length} total (+${newItems.length} new from Naver)`);
}

main().catch(e => { console.error(e); process.exit(1); });
