import { assert, expect } from 'chai';
import Sinon from 'sinon';
import { Changelog } from '../lib/changelog.js';
import { Tag } from '../lib/tag.js';

describe('Changelog', function () {
  describe('Auto Links', function () {
    it('body should add auto links', function () {
      const body = Changelog.fitAutoLinks(
        'This is my body with EVAN-123\n' +
          'And sometimes EVAN has already in link, like [EVAN-123](evan-123)\n' +
          'EVAN-123\n' +
          '[How about long link? EVAN-321 like this!](evan-321)\n' +
          'some test-123 other\n' +
          'some wrong-123 wrong',
        {
          'evan-': 'test://go-to/evan-<num>',
          'test-': 'test://go-to/test-<num>',
        },
      );

      expect(body).to.eq(
        'This is my body with [EVAN-123](test://go-to/evan-123)\n' +
          'And sometimes EVAN has already in link, like [EVAN-123](evan-123)\n' +
          '[EVAN-123](test://go-to/evan-123)\n' +
          '[How about long link? EVAN-321 like this!](evan-321)\n' +
          'some [test-123](test://go-to/test-123) other\n' +
          'some wrong-123 wrong',
      );
    });

    it('pass when empty body', function () {
      expect(Changelog.fitAutoLinks('', { 'evan-': 'test' })).to.be.eq('');
    });

    it('pass when no auto-links', function () {
      expect(Changelog.fitAutoLinks('my-body', {})).to.be.eq('my-body');
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
        'QQ\n\n' +
        '[unreleased]: https://hi/unreleased\n' +
        '[v1.2.3-rc1]: https://hi/v1.2.3-rc1\n' +
        '[v1.2.2]: https://hi/v1.2.2\n',
    );
  }

  it('should parse tag from source', function () {
    const changelog = createChangelog();
    const testData: [string, string, string][] = [
      ['Unreleased', 'Some unreleased', ''],
      ['v1.2.3-rc1', 'Hi there', '2022-02-03'],
      ['V1.2.2', 'QQ', '2022-02-01'],
    ];

    for (const [key, body, date] of testData) {
      const tag = changelog.getTagByKey(key);
      if (!tag) assert.fail(`should not be undefined on ${key}`);
      expect(tag.key).eq(key);
      expect(tag.body).eq(body);
      expect(tag.createdDate).eq(date);
    }
  });

  it('should serialized after add tag', function () {
    const changelog = createChangelog();
    const tag1 = new Tag('new-version-1.2.3', 'This is body\n\n', {
      createdDate: '2022-12-30',
    });
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
      '單號：\n\n' +
      'Newer one\n\nhi there\n\n' +
      '## [new-version-1.2.3] - 2022-12-30\n\n' +
      '單號：\n\n' +
      'This is body\n\n' +
      '## [v1.2.3-rc1] - 2022-02-03\n\n' +
      'Hi there\n\n' +
      '## [V1.2.2] - 2022-02-01\n\n' +
      'QQ\n\n' +
      '[unreleased]: https://github.com/example/example/compare/new-version-1.2.4...HEAD\n' +
      '[new-version-1.2.4]: https://github.com/example/example/compare/new-version-1.2.4...new-version-1.2.3\n' +
      '[new-version-1.2.3]: https://github.com/example/example/compare/new-version-1.2.3...v1.2.3-rc1\n' +
      '[v1.2.3-rc1]: https://hi/v1.2.3-rc1\n' +
      '[v1.2.2]: https://hi/v1.2.2\n';

    // testing twice times avoid mutate after output
    expect(changelog.toString()).eq(expected);
    expect(changelog.toString()).eq(expected);
  });

  beforeEach(function () {
    Sinon.stub(console, 'log');
  });

  afterEach(function () {
    Sinon.restore();
  });
});
