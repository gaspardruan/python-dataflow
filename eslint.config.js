// @ts-check
import antfu from '@antfu/eslint-config';

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
      'node_modules',
    ],
    stylistic: {
      semi: true,
    },
  },
  {
    rules: {
      // overrides
      'style/max-len': ['warn', 120],
      'no-console': 'off',
      'ts/no-this-alias': ['warn', { allowDestructuring: true, allowedNames: ['toSet'] }],
    },
  },
);
