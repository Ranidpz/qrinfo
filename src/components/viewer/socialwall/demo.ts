// Social Wall DEMO backend: an in-memory stand-in for /api/socialwall/* so the REAL participant app
// runs on /play/social-wall with no code, no Firestore and no storage. Installed only by that page
// (it patches window.fetch for /api/socialwall/* and XMLHttpRequest for the upload). Colleagues
// "post" and "like" on a timer so the feed feels alive. Nothing leaves the browser.

import type { SocialWallPostView } from '@/types/socialwall';

export const DEMO_CODE_ID = 'socialwalldemo01';

const PEOPLE: [string, string, string][] = [
  ['דניאל כהן', 'hr', 'צוות מנצח! 😍'],
  ['מעיין לוי', 'rnd', 'אין כמו לעבוד עם אנשים כאלה 💙'],
  ['שרון לוי', 'mkt', 'יום מדהים עם הצוות'],
  ['איתי ברק', 'rnd', ''],
  ['נועה פרץ', 'ops', 'מי אמר שתפעול לא יודעים לחגוג?'],
  ['רוני אדרי', 'fin', 'הכספים בשטח 🌴'],
  ['גיל שמש', 'mgmt', 'גאה בכל אחד ואחת מכם'],
  ['שירה מזרחי', 'mkt', 'שיווק במיטבו 📸'],
  ['עומר דהן', 'ops', ''],
  ['ליאור כץ', 'hr', 'רגעים קטנים, זיכרונות גדולים'],
];
const SIZES: [number, number][] = [[1200, 900], [960, 469], [960, 561], [960, 480], [960, 630], [960, 826], [960, 688], [960, 546], [960, 529], [960, 569]];
const LATER: [string, string, string][] = [
  ['יעל אברהם', 'fin', 'רגע לפני הפעילות הבאה!'],
  ['תום גולן', 'rnd', 'R&D on tour ✌️'],
  ['הדר שלום', 'mgmt', 'תודה לכולם על יום מושלם'],
];

const photo = (i: number) => `/play/social-wall/p${(i % 10) + 1}.webp`;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SESSION_ID = 'd'.repeat(32);

interface DemoPost extends SocialWallPostView {
  updatedAt: number;
}

export function installSocialWallDemo(opts: { reset: boolean }) {
  const w = window as unknown as { __swDemo?: boolean };
  if (w.__swDemo) return;
  w.__swDemo = true;

  const key = `sw_session_${DEMO_CODE_ID}`;
  if (opts.reset) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  const start = Date.now();
  let me = { name: '', groupId: null as string | null };
  try {
    const s = JSON.parse(localStorage.getItem(key) || 'null');
    if (s?.name) me = { name: s.name, groupId: s.groupId ?? null };
  } catch {
    /* ignore */
  }

  const posts: DemoPost[] = PEOPLE.map(([authorName, groupId, caption], i) => ({
    id: uuid(i + 1),
    authorName,
    groupId,
    caption,
    fullUrl: photo(i),
    cardUrl: photo(i),
    width: SIZES[i][0],
    height: SIZES[i][1],
    likeCount: [124, 87, 56, 42, 39, 33, 28, 21, 17, 12][i],
    likedByMe: false,
    createdAt: start - (i * 9 + 4) * 60_000,
    updatedAt: start,
  }));
  const liked = new Set<string>();
  const view = (p: DemoPost): SocialWallPostView => ({ ...p, likedByMe: liked.has(p.id) });

  // Colleagues keep the feed alive: likes every few seconds, a new post now and then
  let nextLater = 0;
  setInterval(() => {
    const p = posts[Math.floor(Math.random() * Math.min(posts.length, 6))];
    if (p && !p.mine) {
      p.likeCount += 1 + Math.floor(Math.random() * 3);
      p.updatedAt = Date.now();
    }
  }, 6000);
  setInterval(() => {
    if (nextLater >= LATER.length) return;
    const [authorName, groupId, caption] = LATER[nextLater];
    const i = nextLater + 3;
    posts.unshift({
      id: uuid(100 + nextLater),
      authorName,
      groupId,
      caption,
      fullUrl: photo(i),
      cardUrl: photo(i),
      width: SIZES[i % 10][0],
      height: SIZES[i % 10][1],
      likeCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    nextLater++;
  }, 40_000);

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin);
    if (!url.pathname.startsWith('/api/socialwall/')) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 250));
    const route = url.pathname.replace('/api/socialwall/', '');
    const method = init?.method || 'GET';
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};

    if (route === 'join') {
      if (body.action === 'send') return json({ success: true, codeLength: 4, cooldownSeconds: 30 });
      me = { name: body.name || me.name || 'אורח', groupId: body.groupId || null };
      return json({ success: true, session: `${SESSION_ID}.${'e'.repeat(48)}`, memberId: SESSION_ID, ...me, needsProfile: false });
    }
    if (route === 'me' && method === 'GET') {
      const mineCount = posts.filter((p) => p.mine).length;
      return json({ memberId: SESSION_ID, ...me, postCount: mineCount, postsLeft: 40 - mineCount, needsProfile: !me.name, control: { screen: 'live', uploads: true } });
    }
    if (route === 'me') {
      if (body.name) me.name = body.name;
      if (body.groupId !== undefined) me.groupId = body.groupId;
      return json({ success: true, ...me, needsProfile: false });
    }
    if (route === 'feed') {
      const now = Date.now();
      if (url.searchParams.has('since')) {
        const since = Number(url.searchParams.get('since'));
        return json({ posts: posts.filter((p) => p.updatedAt > since).map(view), serverTime: now - 1500 });
      }
      const g = url.searchParams.get('group');
      return json({ posts: posts.filter((p) => !g || p.groupId === g).map(view), nextCursor: null, serverTime: now - 1500 });
    }
    if (route === 'posts' && method === 'GET') return json({ posts: posts.filter((p) => p.mine).map(view) });
    if (route === 'posts' && method === 'DELETE') {
      const i = posts.findIndex((p) => p.id === body.postId);
      if (i >= 0) posts.splice(i, 1);
      return json({ success: true });
    }
    if (route === 'like') {
      const p = posts.find((x) => x.id === body.postId);
      if (!p) return json({ errorCode: 'NOT_FOUND' }, 404);
      if (liked.has(p.id) !== body.on) {
        if (body.on) liked.add(p.id);
        else liked.delete(p.id);
        p.likeCount += body.on ? 1 : -1;
        p.updatedAt = Date.now();
      }
      return json({ success: true, liked: body.on, likeCount: p.likeCount });
    }
    return json({ errorCode: 'NOT_FOUND' }, 404);
  };

  // Upload with a believable progress bar; the photo stays in this browser (object URL)
  class DemoXHR {
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    status = 0;
    responseText = '';
    timeout = 0;
    open() {}
    setRequestHeader() {}
    send(form: FormData) {
      const file = form.get('file') as Blob;
      const postId = String(form.get('postId'));
      const caption = String(form.get('caption') || '');
      let loaded = 0;
      const tick = setInterval(() => {
        loaded = Math.min(1, loaded + 0.14);
        this.upload.onprogress?.({ lengthComputable: true, loaded: loaded * 100, total: 100 } as ProgressEvent);
        if (loaded < 1) return;
        clearInterval(tick);
        const src = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const post: DemoPost = {
            id: postId,
            authorName: me.name,
            groupId: me.groupId,
            caption,
            fullUrl: src,
            cardUrl: src,
            width: img.naturalWidth,
            height: img.naturalHeight,
            likeCount: 0,
            mine: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          posts.unshift(post);
          // A couple of colleagues like it a few seconds later
          setTimeout(() => {
            post.likeCount += 3;
            post.updatedAt = Date.now();
          }, 7000);
          this.status = 200;
          this.responseText = JSON.stringify({ success: true, post: view(post), postsLeft: 40 - posts.filter((p) => p.mine).length });
          this.onload?.();
        };
        img.src = src;
      }, 200);
    }
  }
  (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = DemoXHR;
}
