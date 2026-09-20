import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Tests import actual TS source with explicit dependency stubs. No Firebase,
// storage or email credentials are loaded, and no production client is created.
export async function loadTs(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [specifier, replacement] of Object.entries(replacements)) {
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(replacement));
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const code = `${outputText}\n//# sourceURL=${new URL(relativePath, import.meta.url).pathname}\n`;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
export function stub(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
