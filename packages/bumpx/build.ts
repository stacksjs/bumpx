import { dts } from 'bun-plugin-dtsx'

await Bun.build({
  entrypoints: ['src/index.ts', 'bin/cli.ts'],
  splitting: true,
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  // Not minified, on purpose.
  //
  // A CLI gains almost nothing from minification and loses every stack trace
  // it will ever print. Minified, this bundle is a handful of ~20 KB lines, so
  // the six lines of context a runtime prints around a throw come out as tens
  // of kilobytes of one-line JavaScript — enough to scroll the actual message
  // off the screen for something like a mistyped release type.
  //
  // Sourcemaps are shipped for the same reason: a frame that does print should
  // point at real source instead of a bundle offset.
  minify: false,
  sourcemap: 'linked',
  plugins: [dts()],
})
