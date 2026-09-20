import { mkdir, cp, rm, readFile, writeFile, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const stage = path.join(tmpdir(), `theq-native-package-${version}`);
const app = path.join(stage, 'The Q WhatsApp Agent.app');
await rm(stage, { recursive: true, force: true });
await mkdir(path.join(app, 'Contents/MacOS'), { recursive: true });
const resources = path.join(app, 'Contents/Resources');
await mkdir(resources, { recursive: true });
const binaries = [];
for (const arch of ['arm64', 'x86_64']) {
  const scratch = path.join(tmpdir(), `theq-native-release-${arch}`);
  console.log(`Building ${arch}...`);
  await exec('/usr/bin/swift', ['build', '--package-path', path.join(root, 'macos'), '--scratch-path', scratch, '--arch', arch, '-c', 'release'], { maxBuffer: 20e6 });
  const { stdout } = await exec('/usr/bin/swift', ['build', '--package-path', path.join(root, 'macos'), '--scratch-path', scratch, '--arch', arch, '-c', 'release', '--show-bin-path']);
  binaries.push(path.join(stdout.trim(), 'WhatsAppAgent'));
}
await exec('/usr/bin/lipo', ['-create', ...binaries, '-output', path.join(app, 'Contents/MacOS/WhatsAppAgent')]);
const payload = path.join(resources, 'payload');
await mkdir(payload);
for (const name of ['src', 'config', 'package.json', 'package-lock.json', 'README_HE.md']) await cp(path.join(root, name), path.join(payload, name), { recursive: true });
await mkdir(path.join(payload, 'node_modules'));
for (const name of ['playwright', 'playwright-core']) await cp(path.join(root, 'node_modules', name), path.join(payload, 'node_modules', name), { recursive: true });
const icons = await mkdtemp(path.join(tmpdir(), 'theq-icon-'));
const iconset = path.join(icons, 'AppIcon.iconset'); await mkdir(iconset);
for (const size of [16,32,128,256,512]) for (const scale of [1,2]) {
  const pixels = size * scale;
  await exec('/usr/bin/sips', ['-z', String(pixels), String(pixels), path.resolve(root, '../../public/icons/icon-512x512.png'), '--out', path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`)]);
}
await exec('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'AppIcon.icns')]);
await rm(icons, { recursive: true, force: true });
await writeFile(path.join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleExecutable</key><string>WhatsAppAgent</string><key>CFBundleIdentifier</key><string>app.theq.whatsapp-agent</string><key>CFBundleName</key><string>The Q WhatsApp Agent</string><key>CFBundleDisplayName</key><string>סוכן וואטסאפ</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${version}</string><key>CFBundleVersion</key><string>${version}</string><key>CFBundleIconFile</key><string>AppIcon</string><key>LSMinimumSystemVersion</key><string>14.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>\n`);
await exec('/usr/bin/plutil', ['-lint', path.join(app, 'Contents/Info.plist')]);
await exec('/usr/bin/codesign', ['--force', '--sign', '-', app]);
await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
await mkdir(path.join(root, 'dist'), { recursive: true });
const zip = path.join(root, 'dist', `TheQ-WhatsApp-Agent-${version}.zip`);
await rm(zip, { force: true });
await exec('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
const hash = createHash('sha256').update(await readFile(zip)).digest('hex');
await writeFile(`${zip}.sha256`, `${hash}  ${path.basename(zip)}\n`);
console.log(JSON.stringify({ app, zip, sha256: hash, signing: 'ad-hoc, not notarized' }));
