import assert from 'node:assert';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Changelog } from '../lib/changelog.js';
import { Tag } from '../lib/tag.js';

void describe('Changelog', function () {
  void describe('Auto Links', function () {
    void it('body should add auto links', function () {
      const body = Changelog.fitAutoLinks(
        'This is my body with EVAN-123\n' +
          'And sometimes EVAN has already in link, like [EVAN-123](evan-123)\n' +
          'EVAN-123\n' +
          '[How about long link? EVAN-321 like this!](evan-321)\n' +
          'some test-123 other\n' +
          'some wrong-123 wrong',
        {
          'evan-': 'test://go-to/evan-{num}',
          'test-': 'test://go-to/test-{num}',
        },
      );

      assert.deepStrictEqual(
        body,
        'This is my body with [EVAN-123](test://go-to/evan-123)\n' +
          'And sometimes EVAN has already in link, like [EVAN-123](evan-123)\n' +
          '[EVAN-123](test://go-to/evan-123)\n' +
          '[How about long link? EVAN-321 like this!](evan-321)\n' +
          'some [test-123](test://go-to/test-123) other\n' +
          'some wrong-123 wrong',
      );
    });

    void it('pass when empty body', function () {
      assert.deepStrictEqual(Changelog.fitAutoLinks('', { 'evan-': 'test' }), '');
    });

    void it('pass when no auto-links', function () {
      assert.deepStrictEqual(Changelog.fitAutoLinks('my-body', {}), 'my-body');
    });
  });

  function createChangelog() {
    return new Changelog(
      '# Header\n\n' +
        'Some message\n\n' +
        '## Second header\n\n' +
        'Hi there\n\n' +
        '## [Unreleased]\n\n' +
        'Some unreleased\n\n' +
        '## [v1.2.3-rc1] - 2022-02-03\n\n' +
        'Hi there\n\n' +
        '## [V1.2.2] - 2022-02-01\n\n' +
        '### QQ\n\n' +
        'QQ\n\n' +
        '[unreleased]: https://hi/unreleased\n' +
        '[v1.2.3-rc1]: https://hi/v1.2.3-rc1\n' +
        '[v1.2.2]: https://hi/v1.2.2\n',
    );
  }

  void it('should parse tag from source', function () {
    const changelog = createChangelog();
    const testData: [string, string, string][] = [
      ['Unreleased', 'Some unreleased', ''],
      ['v1.2.3-rc1', 'Hi there', '2022-02-03'],
      ['V1.2.2', '### QQ\n\nQQ', '2022-02-01'],
    ];

    for (const [key, body, date] of testData) {
      const tag = changelog.getTagByKey(key);
      if (!tag) assert.fail(`should not be undefined on ${key}`);
      assert.deepStrictEqual(tag.key, key);
      assert.deepStrictEqual(tag.body, body);
      assert.deepStrictEqual(tag.createdDate, date);
    }
  });

  void it('serialized after adding tag', function () {
    const changelog = createChangelog();
    const tag1 = new Tag(
      'new-version-1.2.3',
      'This is body\n\n<!-- bumper-changelog-ignore-start -->\nThis will ignored\n<!-- bumper-changelog-ignore-end -->\n',
      {
        createdDate: '2022-12-30',
      },
    );
    const tag2 = new Tag('new-version-1.2.4', '\n\nNewer one\n\nhi there', {
      createdDate: '2022-12-31',
    });

    changelog.addTag(tag1).addTag(tag2);

    const expected =
      '# Header\n\n' +
      'Some message\n\n' +
      '## Second header\n\n' +
      'Hi there\n\n' +
      '## [Unreleased]\n\n' +
      'Some unreleased\n\n' +
      '## [new-version-1.2.4] - 2022-12-31\n\n' +
      'Newer one\n\nhi there\n\n' +
      '## [new-version-1.2.3] - 2022-12-30\n\n' +
      'This is body\n\n' +
      '## [v1.2.3-rc1] - 2022-02-03\n\n' +
      'Hi there\n\n' +
      '## [V1.2.2] - 2022-02-01\n\n' +
      '### QQ\n\n' +
      'QQ\n\n' +
      '[unreleased]: https://github.com/evan361425/version-bumper/compare/new-version-1.2.4...HEAD\n' +
      '[new-version-1.2.4]: https://github.com/evan361425/version-bumper/compare/new-version-1.2.3...new-version-1.2.4\n' +
      '[new-version-1.2.3]: https://github.com/evan361425/version-bumper/compare/v1.2.3-rc1...new-version-1.2.3\n' +
      '[v1.2.3-rc1]: https://hi/v1.2.3-rc1\n' +
      '[v1.2.2]: https://hi/v1.2.2\n';

    // testing twice times avoid mutate after output
    assert.deepStrictEqual(changelog.toString(), expected);
    assert.deepStrictEqual(changelog.toString(), expected);
  });

  beforeEach(function () {
    mock.method(console, 'log');
  });

  afterEach(function () {
    mock.restoreAll();
  });
});
