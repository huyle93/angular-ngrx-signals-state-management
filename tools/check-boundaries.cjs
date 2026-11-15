// Probe the real ESLint/Nx rule using an actual project path, without leaving an illegal source file.
const { ESLint } = require('eslint');
async function main() {
  const eslint = new ESLint({ overrideConfigFile: 'eslint.config.cjs' });
  const probes = [
    [
      'libs/fi/instrument/data-access/src/forbidden-probe.ts',
      "export { DemoTradeComponent } from '@fi/trading/demo-trade.component';",
      '@nx/enforce-module-boundaries',
    ],
    [
      'libs/fi/instrument/ui/src/forbidden-probe.ts',
      "export { InstrumentStore } from '@fi/instrument-data-access/instrument.store';",
      '@nx/enforce-module-boundaries',
    ],
    [
      'libs/fi/instrument/util/src/forbidden-probe.ts',
      "export { IonContent } from '@ionic/angular/standalone';",
      'no-restricted-imports',
    ],
  ];
  for (const [filePath, code, expectedRule] of probes) {
    const [result] = await eslint.lintText(code, { filePath });
    if (
      !result.messages.some(
        (message) => message.ruleId === expectedRule && message.severity === 2,
      )
    ) {
      throw new Error(
        `Forbidden import was NOT rejected by ${expectedRule}: ${filePath}`,
      );
    }
    console.log(
      `EXPECTED REJECTION ${filePath}: ${result.messages
        .filter((m) => m.ruleId === expectedRule)
        .map((m) => m.message)
        .join('; ')}`,
    );
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
