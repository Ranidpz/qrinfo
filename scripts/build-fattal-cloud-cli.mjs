import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Fixed trusted source list. No runtime compilation of user files or credentials.
const destination = new URL('../build/fattal-cloud/', import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL('package.json', destination), '{"type":"commonjs"}\n');
for (const name of ['run-telemetry', 'fattal', 'cloud-policy', 'cloud-upload-journal', 'cloud-uploader']) {
  const source = await readFile(new URL(`../src/lib/content-intake/${name}.ts`, import.meta.url), 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  await writeFile(new URL(`${name}.js`, destination), result.outputText);
}
process.stdout.write('Built server-only Fattal CLI modules. No network or secrets used.\n');
