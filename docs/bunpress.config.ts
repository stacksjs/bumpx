import type { BunPressOptions } from '@stacksjs/bunpress'

const config: BunPressOptions = {
  title: 'bumpx',
  description: 'Automatically bump your versions',
  nav: [
    { text: 'Guide', link: '/intro' },
    { text: 'Features', link: '/features/version-bumping' },
    { text: 'Advanced', link: '/advanced/configuration' },
    {
      text: 'Changelog',
      link: 'https://github.com/stacksjs/bumpx/blob/main/CHANGELOG.md',
    },
  ],
  themeConfig: {
    siteTitle: 'bumpx',
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Bumpx?', link: '/intro' },
          { text: 'Installation', link: '/install' },
          { text: 'Usage', link: '/usage' },
          { text: 'Configuration', link: '/config' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/usage' },
          { text: 'CLI Commands', link: '/usage#basic-usage' },
          { text: 'Library API', link: '/usage#library-usage' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Version Bumping', link: '/features/version-bumping' },
          { text: 'Git Tags', link: '/features/git-tags' },
          { text: 'Changelog Generation', link: '/features/changelog-generation' },
          { text: 'Monorepo Support', link: '/features/monorepo-support' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Configuration', link: '/advanced/configuration' },
          { text: 'Custom Scripts', link: '/advanced/custom-scripts' },
          { text: 'Performance', link: '/advanced/performance' },
          { text: 'CI/CD Integration', link: '/advanced/ci-cd-integration' },
        ],
      },
    ],
  },
  sitemap: {
    enabled: true,
    baseUrl: 'https://bumpx.stacksjs.org',
  },
  robots: {
    enabled: true,
  },
}

export default config
