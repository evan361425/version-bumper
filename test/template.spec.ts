import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Template } from '../lib/factories.js';

void describe('Template', function () {
  void it('commit message', async function () {
    const temp = new Template(
      '- ({#"prLink.prefixInLink"|hashLink}{|"autoLink"}) {"scope.upper": }{title}{ - @"author"}',
    );

    assert.strictEqual(
      await temp.formatContent({
        repo: '<repo>',
        title: '<title>',
        titleTail: '<titleTail>',
        titleFull: '<titleFull>',
        author: '<author>',
        hash: '<hash>',
        hashLink: '<hashLink>',
        hashFull: '<hashFull>',
        // provide pr to check not overwriting prLink
        pr: '<pr>',
        prLink: '[123](link)',
        scope: '<scope>',
        autoLink: '<autoLink>',
      }),
      '- ([#123](link)|<autoLink>) <SCOPE>: <title> - @<author>',
    );
    assert.strictEqual(
      await temp.formatContent({
        title: '<title>',
        author: '<author>',
        hash: '<hash>',
        hashLink: '<hashLink>',
        prLink: '',
        scope: '',
        autoLink: '',
      }),
      '- (<hashLink>) <title> - @<author>',
    );
  });

  void it('commit message', async function () {
    const temp = new Template(`This PR is auto-generated from bumper
{<NL>- ticket: "ticket"}{<NL>- name: "versionName"}
- version: [{"version.noPrefix"}]({repo}/releases/tag/{version})
- [{versionLast} - {version}]({diffLink})

{content}
`);

    const result = await temp.formatContent({
      repo: '<repo>',
      version: 'v1.2.3',
      versionName: '<versionName>',
      versionLast: '<versionLast>',
      ticket: '<ticket>',
      diffLink: '<diffLink>',
      content: '<content>',
    });
    assert.strictEqual(
      result,
      `This PR is auto-generated from bumper

- ticket: <ticket>
- name: <versionName>
- version: [1.2.3](<repo>/releases/tag/v1.2.3)
- [<versionLast> - v1.2.3](<diffLink>)

<content>
`,
    );
  });
});
