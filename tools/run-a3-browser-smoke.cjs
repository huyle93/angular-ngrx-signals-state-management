const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

function cli(args) {
  const result = spawnSync(
    'npx',
    [
      '--yes',
      '--package=@playwright/cli@0.1.24',
      'playwright-cli',
      '-s=a3',
      ...args,
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.error) throw result.error;
  const output = (result.stdout || '') + (result.stderr || '');
  // The CLI can return exit 0 for a failed browser action. Treat its error
  // envelope as a failed Nx task rather than recording a false pass.
  if (result.status !== 0 || output.includes('### Error'))
    throw new Error(output);
  return output;
}
try {
  cli(['open', 'http://localhost:4200/fi/LUMA', '--headed']);
  const code = readFileSync('tools/a3-browser-smoke.js', 'utf8')
    .trim()
    .replace(/;$/, '');
  const output = cli(['run-code', code]);
  const match = output.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!match) throw new Error('Browser runner returned no structured result.');
  console.log(JSON.stringify(JSON.parse(match[1]), null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
