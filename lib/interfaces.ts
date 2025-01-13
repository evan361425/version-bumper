/**
 * Repository settings.
 */
export interface IRepo {
  /**
   * Link to the repository, it will use for tags in Changelog.
   *
   * @default using `git remote get-url origin`, if not found, use `https://github.com/example/example`
   * @example https://github.com/example/example
   */
  link: string;
}
/**
 * How to process the version bumping.
 */
export interface IProcess {
  /**
   * Only create PR, no other actions.
   */
  prOnly: boolean;
  /**
   * Only create release, no other actions.
   */
  releaseOnly: boolean;
  /**
   * Don't push any changes to remote, but all other actions will be executed.
   */
  noPush: boolean;
  /**
   * Throw error if the tag already exists.
   *
   * @default false if in `prOnly` or `releaseOnly` mode, otherwise true
   */
  throwErrorIfTagExist: boolean;
}
/**
 * Changelog settings.
 */
export interface IChangelog {
  /**
   * Disable changelog generation.
   */
  disable: boolean;
  /**
   * File path to the changelog file.
   */
  destination: string;
  /**
   * Changelog template.
   *
   * Allowed variables:
   * - `{content}`: new version changelog body.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number set in latest info
   */
  template: ITemplate;
}
/**
 * Autolink settings.
 */
export interface IAutoLink {
  /**
   * Pattern to match the commit title.
   *
   * This is not a regular expression, but a list of prefixes.
   *
   * Special variables:
   * - `{num}`: ticket number
   *
   * @example `MYPROJ-{num}`
   */
  matches: string[];
  /**
   * Replace the matched pattern with the link.
   *
   * Allowed variables:
   * - `{num}`: ticket number
   *
   * @example `https://jira.com/browse/MYPROJ-{num}`
   */
  link: string;
}
/**
 * Pull Request settings.
 */
export interface IPR {
  /**
   * PR's title template.
   *
   * This will trim the title to 100 characters and append `...` if it's too long.
   * Will replace new line with space and trim the title before use.
   *
   * Allowed variables:
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{ticket}`: ticket number
   */
  title: ITemplate;
  /**
   * PR's body template.
   *
   * Allowed variables:
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{ticket}`: ticket number
   * - `{content}`: changelog content
   * - `{diffLink}`: link to the diff of this version
   */
  body: ITemplate;
}
/**
 * Auto generate release notes.
 */
export interface IDiff {
  /**
   * How to group the commits.
   */
  groups: IDiffGroup[];
  /**
   * Title of the group if not found.
   *
   * @example Others
   */
  fallbackGroupTitle: string;
  /**
   * Template of single list item.
   *
   * Allowed variables:
   * - `{title}`: commit title after `:`
   * - `{titleFull}`: full commit title, which is the first line of the commit message
   * - `{message}`: full commit message
   * - `{author}`: commit author
   * - `{hash}`: commit hash, but only first 7 characters
   * - `{hashFull}`: commit hash
   * - `{pr}`: PR number, if not found, it will use `hash`
   * - `{ticket}`: ticket number, if not found, it will use empty string
   * - `{scope}`: commit scope, if not found, it will use empty string, see `scopeNames`
   */
  template: ITemplate;
  /**
   * Scope names.
   *
   * For example, `feat(core): add something`, the scope is `core`.
   * This will replace the scope with the name in the object.
   *
   * @example { core: 'Core', ui: 'Web UI' }
   */
  scopeNames: Record<string, string>;
  /**
   * Pattern to ignore the commit.
   */
  ignored: string[];
}
/**
 * Group commits in the changelog.
 */
export interface IDiffGroup {
  /**
   * Which commits to include.
   *
   * Regular Expression pattern to match the commit title.
   *
   * Recommended to follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.
   *
   * @example `^fix`, `^feat`, `^[\w\(\)]+!`, `^remove`
   */
  matches: string[];
  /**
   * Title of the group.
   *
   * Recommended to follow the [KeepAChangelog](https://keepachangelog.com/en/1.0.0/) format.
   *
   * @example 'Fixed', 'Added', 'Changed', 'Removed'
   */
  title: string;
}
/**
 * Tag settings.
 *
 * This will be used as list and the first match of the pattern will be used.
 */
export interface ITag {
  /**
   * Name of the tag.
   *
   * Default is empty value which will be considered as no name.
   *
   * @example stable
   */
  name: string;
  /**
   * Regular Expression pattern to match the tag.
   *
   * @example v[0-9]+.[0-9]+.[0-9]+-rc[0-9]+
   */
  pattern: string;
  /**
   * Should use this tag to generate changelog.
   */
  withChangelog: boolean;
  /**
   * Something about GitHub Release.
   */
  release: IRelease;
  /**
   * Something about PR's branch.
   */
  prBranches: IPRBranch[];
}
/**
 * GitHub Release settings.
 */
export interface IRelease {
  /**
   * Enable GitHub Release.
   */
  enable: boolean;
  /**
   * Title of the release.
   *
   * Allowed variables:
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{ticket}`: ticket number set in latest info
   *
   * @example Stable-{version}
   */
  title: ITemplate;
  /**
   * Release body.
   *
   * Allowed variables:
   * - `{content}`: new version changelog body.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number set in latest info
   */
  body: ITemplate;
  /**
   * Is this a pre-release.
   */
  preRelease: boolean;
  /**
   * Is this a draft release.
   */
  draft: boolean;
}
/**
 * Branch settings.
 */
export interface IPRBranch {
  /**
   * Source branch.
   *
   * Allowed variables:
   * - `{name}`: tag name
   * - `{timestamp}`: current timestamp
   *
   * This will create the branch if not exists.
   *
   * @example `main`
   */
  head: string;
  /**
   * Target branch.
   *
   * Allowed variables:
   * - `{name}`: tag name
   *
   * @example `deploy/{name}`
   */
  base: string;
  /**
   * Labels to add to the PR.
   */
  labels: string[];
  /**
   * Reviewers to add to the PR.
   */
  reviewers: string[];
  /**
   * What content to replace in the branch.
   */
  replacements: IPRReplace[];
  /**
   * Commit message template.
   *
   * If not set, it will use the message in `tag.prBranches[].replacements[].commitMessage`.
   * One of them must be set.
   *
   * Allowed variables:
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{ticket}`: ticket number set in latest info
   */
  commitMessage?: ITemplate;
}
/**
 * PR's files replacement settings.
 */
export interface IPRReplace {
  /**
   * Commit message template.
   *
   * If not set, it will use the message in `tag.prBranches[].commitMessage`.
   * One of them must be set.
   *
   * Allowed variables:
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{ticket}`: ticket number set in latest info
   */
  commitMessage?: ITemplate;
  /**
   * File path to replace.
   */
  paths: string[];
  /**
   * Regular Expression pattern to find.
   *
   * @example `version: [0-9]+.[0-9]+.[0-9]+$`
   */
  pattern: string;
  /**
   * Replacement string.
   *
   * Allowed variables:
   * - `{version}`: version number
   *
   * @example `version: {version}`
   */
  replacement: string;
}
/**
 * Template settings.
 */
export interface ITemplate {
  /**
   * File path to the template file.
   *
   * Priority: 3
   */
  file: string;
  /**
   * Plain text template.
   *
   * Priority: 1, first to be used.
   */
  value: string;
  /**
   * Query to get the template.
   *
   * Priority: 2
   */
  github?: ITemplateGitHub;
}
export interface ITemplateGitHub {
  /**
   * Repository name.
   *
   * @example evan361425/version-bumper
   */
  repo: string;
  /**
   * The branch to get the template.
   *
   * @example master
   */
  branch: string;
  /**
   * File path to the template file.
   *
   * @example docs/TEMPLATE.md
   */
  path: string;
}
