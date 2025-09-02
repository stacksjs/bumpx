import { dts } from 'bun-plugin-dtsx'

await Bun.build({
  entrypoints: ['src/index.ts', 'bin/cli.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  minify: true,
  plugins: [dts()],
})
