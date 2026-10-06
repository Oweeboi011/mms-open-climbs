// semantic-release config for .github/workflows/create-release.yml.
// Tags vX.Y.Z on main and publishes a GitHub release; nothing is committed back.
const OTHER = 'Other Updates';

module.exports = {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance Improvements' },
            { type: 'revert', section: 'Reverts' },
            ...['docs', 'style', 'chore', 'refactor', 'test', 'build', 'ci'].map((type) => ({
              type,
              section: OTHER,
            })),
          ],
        },
      },
    ],
    '@semantic-release/github',
  ],
};
