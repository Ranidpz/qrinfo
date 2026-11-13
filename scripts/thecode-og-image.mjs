// Builds the link-preview image for the Gnome Code guide (1200x630, no text: Hebrew can't be
// trusted in rasterisers). Gnome shape = the same drawing as GnomeFigure.tsx.
import sharp from 'sharp';
const out = process.argv[2];
const g = (b, h) => `
<rect x="14" y="104" width="68" height="12" rx="4" fill="#2A2F3A" stroke="#11131A" stroke-width="2"/>
<ellipse cx="36" cy="103" rx="10" ry="5" fill="#5A3A22" stroke="#11131A" stroke-width="2"/>
<ellipse cx="60" cy="103" rx="10" ry="5" fill="#5A3A22" stroke="#11131A" stroke-width="2"/>
<path d="M22 102 C20 78 30 62 48 62 C66 62 76 78 74 102 Z" fill="${b}" stroke="#11131A" stroke-width="2.5"/>
<path d="M58 64 C68 70 74 84 74 102 L62 102 C64 86 62 74 58 64 Z" fill="rgba(10,12,30,.22)"/>
<path d="M30 72 C27 80 26 88 26 96" stroke="rgba(255,255,255,.28)" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M23.5 88 C38 92 58 92 72.5 88 L73 94 C58 98 38 98 23 94 Z" fill="#2B2116" stroke="#11131A" stroke-width="2"/>
<rect x="44" y="88.5" width="8" height="7" rx="1.5" fill="#F4B740" stroke="#11131A" stroke-width="1.5"/>
<circle cx="22" cy="84" r="5.5" fill="#F6B996" stroke="#11131A" stroke-width="2"/>
<circle cx="74" cy="84" r="5.5" fill="#F6B996" stroke="#11131A" stroke-width="2"/>
<path d="M33 58 C32 73 40 83 48 83 C56 83 64 73 63 58 Z" fill="#FFFFFF" stroke="#11131A" stroke-width="2.5"/>
<path d="M31 57 C34 65 62 65 65 57 C62 52 34 52 31 57 Z" fill="#F6B996" stroke="#11131A" stroke-width="2"/>
<ellipse cx="39.5" cy="57.5" rx="2" ry="2.4" fill="#11131A"/><ellipse cx="56.5" cy="57.5" rx="2" ry="2.4" fill="#11131A"/>
<circle cx="40.2" cy="56.7" r=".7" fill="#fff"/><circle cx="57.2" cy="56.7" r=".7" fill="#fff"/>
<ellipse cx="34.5" cy="62" rx="3" ry="1.8" fill="#FF8C8C" opacity=".55"/><ellipse cx="61.5" cy="62" rx="3" ry="1.8" fill="#FF8C8C" opacity=".55"/>
<ellipse cx="48" cy="62" rx="6.5" ry="5.5" fill="#F2A07C" stroke="#11131A" stroke-width="2.3"/>
<ellipse cx="46" cy="60.3" rx="2" ry="1.3" fill="#fff" opacity=".6"/>
<path d="M48 3 C44 10 40 18 36 28 C31 39 26 48 22 56 C36 50 60 50 74 56 C70 46 64 36 60 27 C56 18 52 10 48 3 Z" fill="${h}" stroke="#11131A" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M48 8 C45 18 40 30 34 44" stroke="rgba(255,255,255,.28)" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M54 22 C58 32 64 42 70 52" stroke="rgba(10,12,30,.22)" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M22 56 C36 49 60 49 74 56 C74 59 73 60 72 61 C58 55 38 55 24 61 C23 60 22 59 22 56 Z" fill="${h}" stroke="#11131A" stroke-width="2.2" stroke-linejoin="round"/>`;
const C = { blue:'#3B82F6', yellow:'#F5C518', red:'#E5484D', purple:'#8E4EC6', black:'#1F2430', white:'#F4F4F5', green:'#30A46C' };
// [body, hat, scale, x-centre]
const row = [[C.green,C.white,2.15,170],[C.red,C.blue,2.5,390],[C.blue,C.yellow,3.1,600],[C.purple,C.black,2.5,810],[C.yellow,C.purple,2.15,1030]];
const floor = 560;
const gnomes = row.map(([b,h,s,x]) => `<g transform="translate(${x - 48*s} ${floor - 116*s}) scale(${s})">${g(b,h)}</g>`).join('');
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stars = Array.from({length: 46}, () => `<circle cx="${(rnd()*1200).toFixed(0)}" cy="${(rnd()*300).toFixed(0)}" r="${(0.8+rnd()*1.8).toFixed(1)}" fill="#FFF4DA" opacity="${(0.25+rnd()*0.6).toFixed(2)}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><radialGradient id="glow" cx="50%" cy="78%" r="60%"><stop offset="0" stop-color="#F4B740" stop-opacity=".30"/><stop offset="1" stop-color="#F4B740" stop-opacity="0"/></radialGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1030"/><stop offset="1" stop-color="#1A2366"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#sky)"/>${stars}<rect width="1200" height="630" fill="url(#glow)"/>
<ellipse cx="600" cy="${floor+8}" rx="560" ry="26" fill="#060920" opacity=".55"/>
${gnomes}</svg>`;
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log('ok', out);
