import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'types/index': 'src/types/index.ts',
    'core/index': 'src/core/index.ts',
    'models/index': 'src/models/index.ts',
    'adapters/index': 'src/adapters/index.ts',
    'clients/index': 'src/clients/index.ts',
    'examples/index': 'src/examples/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['zod', '@google/genai'],
});
