import { dts } from 'bun-plugin-dtsx'

await Bun.build({
  entrypoints: ['src/index.ts', 'bin/cli.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  // @ts-expect-error this exists, unsure why it is an issue
  splitting: true,
  minify: true,
  plugins: [dts()],
})
