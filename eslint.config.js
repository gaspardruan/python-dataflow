// @ts-check
import antfu from '@antfu/eslint-config';

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
    ],
    stylistic: {
      semi: true,
    },
  },
  {
    rules: {
      // overrides
      'style/max-len': ['warn', 120],
    },
  },
);
