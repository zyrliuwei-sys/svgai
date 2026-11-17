import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../.output');
const failures = [];
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else {
      const text = readFileSync(path).toString('utf8');
      if (
        /\{\{BRAND\}\}|\\+\{\\+\{BRAND\\+\}\\+\}|&#123;&#123;BRAND&#125;&#125;/.test(
          text
        )
      )
        failures.push(path);
    }
  }
}
scan(output);
if (failures.length) {
  throw new Error(
    `Unresolved brand placeholder in build output:\n${failures.join('\n')}`
  );
}
console.log('Brand build check passed: 0 unresolved placeholders.');
