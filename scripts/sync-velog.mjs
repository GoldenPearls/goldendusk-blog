import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const VELOG_USER = 'prettylee620';
const API = 'https://v3.velog.io/graphql';
const ROOT = join(import.meta.dirname, '..');
const META_PATH = join(ROOT, 'posts-meta.json');
const CONTENT_DIR = join(ROOT, 'content');

const TAG_TO_CAT = {
  'java': 'Java', 'spring': 'Spring', 'springboot': 'Spring',
  'docker': 'Docker', 'git': 'Git', 'rust': 'Rust',
  'os': 'OS', 'linux': '리눅스', 'network': '네트워크',
  'http': 'HTTP 웹 지식', 'algorithm': '알고리즘', '알고리즘': '알고리즘',
  'data-structure': '자료구조', '자료구조': '자료구조',
  'cs': 'CS 지식', 'security': '보안',
  'effective-java': 'Effective Java', 'effectivejava': 'Effective Java',
  '회고': '회고록', '회고록': '회고록', 'retrospect': '회고록',
  'book': '도서 리뷰', '도서': '도서 리뷰', '도서리뷰': '도서 리뷰', '서평': '도서 리뷰',
  'career': '커리어', '커리어': '커리어', '취업': '커리어', '면접': '커리어',
  'community': '커뮤니티', '커뮤니티': '커뮤니티',
  'certification': '자격증', '자격증': '자격증', '정보처리기사': '정보처리기사',
  'multicampus': '멀티캠퍼스 과정',
  'ci-cd': 'CI-CD', 'cicd': 'CI-CD',
  'troubleshooting': '트러블슈팅',
  'project': '팀프로젝트',
  'essay': '에세이',
};

const CAT_ICONS = {
  'Java': '☕', 'Spring': '🌱', 'Docker': '🐳', 'Git': '🔀', 'Rust': '🦀',
  'OS': '💻', '리눅스': '🐧', '네트워크': '🌐', 'HTTP 웹 지식': '🌐',
  '알고리즘': '🧩', '자료구조': '📊', 'CS 지식': '🖥️', '보안': '🔒',
  'Effective Java': '📘', '회고록': '✍️', '도서 리뷰': '📖',
  '커리어': '🚀', '커뮤니티': '🤝', '자격증': '📜', '정보처리기사': '📜',
  '멀티캠퍼스 과정': '🎓', 'CI-CD': '⚙️', '트러블슈팅': '🔧',
  '팀프로젝트': '👥', '에세이': '📝', '기타': '📌',
};

function tagsToCat(tags) {
  if (!tags?.length) return '기타';
  for (const t of tags) {
    const key = t.toLowerCase().replace(/\s+/g, '-');
    if (TAG_TO_CAT[key]) return TAG_TO_CAT[key];
    if (TAG_TO_CAT[t]) return TAG_TO_CAT[t];
  }
  return '기타';
}

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Velog API ${res.status}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

async function fetchAllPosts() {
  const all = [];
  let cursor = null;
  while (true) {
    const { posts } = await gql(`
      query Posts($input: PostsInput!) {
        posts(input: $input) {
          id title released_at short_description thumbnail url_slug tags
        }
      }
    `, { input: { username: VELOG_USER, limit: 50, cursor } });

    if (!posts?.length) break;
    all.push(...posts);
    cursor = posts[posts.length - 1].id;
    if (posts.length < 50) break;
  }
  return all;
}

async function fetchPostBody(slug) {
  const { post } = await gql(`
    query Post($username: String!, $url_slug: String!) {
      post(username: $username, url_slug: $url_slug) { body }
    }
  `, { username: VELOG_USER, url_slug: slug });
  return post?.body || '';
}

async function main() {
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
  const existingSlugs = new Set(meta.filter(p => p.source === 'velog').map(p => p.slug));
  let nextId = Math.max(...meta.map(p => p.id)) + 1;

  console.log(`Existing: ${meta.length} posts (${existingSlugs.size} from Velog)`);

  const velogPosts = await fetchAllPosts();
  console.log(`Found ${velogPosts.length} on Velog`);

  const newPosts = velogPosts.filter(p => !existingSlugs.has(p.url_slug));
  if (!newPosts.length) {
    console.log('No new posts');
    return;
  }

  console.log(`Syncing ${newPosts.length} new posts...`);

  for (const p of newPosts) {
    const cat = tagsToCat(p.tags);
    const body = await fetchPostBody(p.url_slug);
    const id = nextId++;

    meta.push({
      id,
      title: p.title,
      date: (p.released_at || '').slice(0, 10),
      cat,
      icon: CAT_ICONS[cat] || '📌',
      source: 'velog',
      slug: p.url_slug,
      thumb: p.thumbnail || '',
      url: `https://velog.io/@${VELOG_USER}/${encodeURIComponent(p.url_slug)}`,
      preview: (p.short_description || '').slice(0, 200),
    });

    writeFileSync(join(CONTENT_DIR, `${id}.md`), body, 'utf8');
    console.log(`  + [${id}] ${p.title}`);
    await new Promise(r => setTimeout(r, 300));
  }

  writeFileSync(META_PATH, JSON.stringify(meta), 'utf8');
  console.log(`Done: ${meta.length} total (+${newPosts.length} new)`);
}

main().catch(e => { console.error(e); process.exit(1); });
