const nx = require('@nx/eslint-plugin');
const domainRestrictions = [
  '@ionic/*',
  '@capacitor/*',
  '@angular/router',
  '@fi/*-ui/*',
  '@fi/web/*',
  '@fi/mobile/*',
];

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.nx/**',
      'output/**',
      'external-context/**',
    ],
  },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'scope:fi', onlyDependOnLibsWithTags: ['scope:fi'] },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:experience', 'type:ui'],
            },
            {
              sourceTag: 'type:experience',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:data-access',
                'type:feature',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:data-access',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:util', 'type:ui'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:util'] },
            {
              sourceTag: 'domain:instrument',
              onlyDependOnLibsWithTags: ['domain:instrument', 'domain:shared'],
            },
            {
              sourceTag: 'domain:trading',
              onlyDependOnLibsWithTags: ['domain:trading', 'domain:shared'],
            },
            {
              sourceTag: 'domain:shared',
              onlyDependOnLibsWithTags: ['domain:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'libs/fi/instrument/{util,data-access}/**/*.ts',
      'libs/fi/trading/{util,data-access}/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: domainRestrictions,
        },
      ],
    },
  },
  {
    files: ['libs/fi/{instrument,trading}/util/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...domainRestrictions, '@angular/*', '@ngrx/*'] },
      ],
    },
  },
  {
    files: ['libs/fi/{instrument,trading}/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@angular/router',
            '@ionic/*',
            '@capacitor/*',
            '@fi/*-data-access/*',
            '@ngrx/*',
          ],
        },
      ],
    },
  },
];
