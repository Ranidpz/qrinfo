import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

async function boundedFile(path, maximum) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximum) throw Error('input');
    // Bound the read even if another process grows the file after stat.
    const bytes = Buffer.alloc(maximum + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await file.read(bytes, size, bytes.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > maximum) throw Error('input');
    return bytes.subarray(0, size);
  } finally { await file.close(); }
}
export async function main(args = process.argv.slice(2), environment = process.env, output = text => process.stdout.write(text)) {
  let telemetry;
  try {
    const [command, ...rest] = args;
    if (!['health', 'preview', 'upload', 'recover'].includes(command)) throw Error('input');
    const options = {};
    for (let i = 0; i < rest.length; i += 2) {
      const key = rest[i]; const value = rest[i + 1];
      if (!['--manifest', '--pdf'].includes(key) || !value || value.startsWith('--') || options[key]
        || /tq_(?:fc|ci)_/i.test(value)) throw Error('input');
      options[key] = value;
    }
    if ((command === 'health' && rest.length) || (command !== 'health' && !options['--manifest'])
      || (command === 'upload' ? !options['--pdf'] : options['--pdf'])) throw Error('input');
    // Only non-secret configuration file location may come from host environment.
    // Neither a key flag, dotenv file, nor a secret resolver option is supported.
    if (!environment.FATTAL_CLOUD_UPLOADER_CONFIG) throw Error('disabled');
    const raw = (await boundedFile(environment.FATTAL_CLOUD_UPLOADER_CONFIG, 16384)).toString('utf8');
    if (/tq_(?:fc|ci)_/i.test(raw)) throw Error('configuration');
    const config = JSON.parse(raw);
    const allowed = ['enabled', 'writesEnabled', 'baseUrl', 'ownerId', 'ownerEmail', 'projectId', 'allowedTargets', 'stateDirectory', 'durableStateConfirmed'];
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(k => !allowed.includes(k))) throw Error('configuration');
    if (config.enabled !== true || (command === 'upload' && config.writesEnabled !== true)) throw Error('disabled');
    const { createFattalCloudUploader } = await import('../build/fattal-cloud/cloud-uploader.js');
    const manifest = command === 'health' ? undefined : JSON.parse((await boundedFile(options['--manifest'], 65536)).toString('utf8'));
    const bytes = command === 'upload' ? await boundedFile(options['--pdf'], 3 * 1024 * 1024) : undefined;
    const { createIntakeRunTelemetry } = await import('../build/fattal-cloud/run-telemetry.js');
    telemetry = createIntakeRunTelemetry({ files: bytes ? 1 : 0, bytes: bytes?.length || 0 });
    const client = createFattalCloudUploader(config, { fetch: (...args) => fetch(...args), now: () => Date.now(),
      resolveSecret: async () => environment.FATTAL_CLOUD_CLIENT_KEY, onOperation: telemetry.recordOperation });
    const result = command === 'health' ? await client.health() : command === 'preview' ? await client.preview(manifest)
      : command === 'recover' ? await client.recover(manifest)
      : await client.upload(manifest, bytes);
    output(`${JSON.stringify({ ...result, telemetry: telemetry.finish(result.status === 'uncertain' ? 'uncertain' : result.status === 'superseded' ? 'failed' : 'completed') })}\n`);
    return result.status === 'uncertain' || result.status === 'superseded' ? 2 : 0;
  } catch (error) {
    const codes = ['disabled', 'configuration', 'input', 'credential', 'transport', 'response', 'state', 'pending'];
    const code = codes.includes(error?.code) ? error.code : codes.includes(error?.message) ? error.message : 'configuration';
    output(`${JSON.stringify({ error: code, retryAllowed: false, ...(telemetry ? { telemetry: telemetry.finish(code === 'disabled' ? 'disabled' : 'failed') } : {}) })}\n`);
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
