/**
 * Configuration of the bumper.
 */
export interface IConfig {
  repo: IRepo;
  process: IProcess;
  changelog: IChangelog;
  autoLinks: IAutoLink[];
  pr: IPR;
  diff: IDiff;
  tags: ITag[];
}

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type PartialConfig = DeepPartial<IConfig>;
export type ConfigArguments<T> = T extends ITemplate | KVPairs
  ? string
  : T extends object
    ? {
        [P in keyof T]?: ConfigArguments<T[P]>;
      }
    : string;

export type KVPairs = Record<string, string>;

/**
 * Repository settings.
 */
export interface IRepo {
  /**
   * Link to the repository, it will use for tags in Changelog.
   *
   * @default using `git remote get-url origin`, if not found throw exception
   * @example https://github.com/example/example
   */
  link: string;
}
/**
 * How to process the version bumping.
 */
export interface IProcess {
  /**
   * Whether to bump the version.
   *
   * It will then try to update the changelog file and commit it.
   */
  bump: boolean;
  /**
   * Push all commits and tags.
   */
  push: boolean;
  /**
   * Create PR in tags, and `tags[].prBranches` must be set
   */
  pr: boolean;
  /**
   * Create release in tags, and `tags[].release` must be set
   */
  release: boolean;
  /**
   * Throw error if the tag already exists.
   */
  checkTag: boolean;
  /**
   * Ask for the ticket number if not found.
   */
  wantedTicket: boolean;
  /**
   * Use semantic commit message to map the `diff.groups`.
   *
   * - `^fix` as `Fixed`
   * - `^feat`, `^add` as `Added`
   * - `^[\w\(\)]+!`, `BREAKING CHANGE` as `Changed`, with priority 1
   *
   * @see https://www.conventionalcommits.org/en/v1.0.0/
   */
  useSemanticGroups: boolean;
  /**
   * Add semantic tag naming to `tags`.
   *
   * - Use pattern `v[0-9]+.[0-9]+.[0-9]+` and name `semantic`.
   * - Enable release with default title and body, see default from `tags[].release`.
   * - Enable changelog.
   *
   * @see https://semver.org/
   */
  useSemanticTag: boolean;
  /**
   * Add release candidate (rc) tag naming to `tags`.
   *
   * - Use pattern `v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+` and name `release-candidate`.
   * - Disable release.
   * - Disable changelog.
   *
   * If `useSemanticTag` is enabled, it will pushed after the semantic tag.
   *
   * @see https://semver.org/
   */
  useReleaseCandidateTag: boolean;
}
/**
 * Changelog settings.
 */
export interface IChangelog {
  /**
   * Enable changelog generation.
   */
  enable: boolean;
  /**
   * File path to the changelog file.
   */
  destination: string;
  /**
   * The changelog of specific version.
   *
   * Allowed variables:
   * - `{content}`: new version changelog body from `diff`.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number
   * - `{date}`: current date, format is `YYYY-MM-DD`
   * - `{time}`: current time, format is `HH:mm:ss`
   */
  section: ITemplate;
  /**
   * After update the changelog, commit the changes.
   */
  commit: IChangelogCommit;
}
/**
 * How to commit the changelog.
 */
export interface IChangelogCommit {
  /**
   * Commit message template.
   *
   * Allowed variables:
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{ticket}`: ticket number
   */
  message: ITemplate;
  /**
   * Execute `git add .` not only the changelog.
   */
  addAll: boolean;
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

  /**
   * Extract ticket from the content.
   */
  extract(content: string): string | undefined;
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
   * - `{versionName}`: version name set in tag config
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
   * Title of the group that doesn't match any group.
   *
   * If `ignoreOthers` is enabled, this will not be used.
   *
   * @example Others
   */
  othersTitle: string;
  /**
   * Template of single list item.
   *
   * Allowed variables:
   * - `{title}`: commit title after `:` add will remove all the pr number and autoLink if found
   * - `{titleTail}`: commit title after `:`
   * - `{titleFull}`: full commit title, which is the first line of the commit message
   * - `{author}`: commit author
   * - `{hash}`: commit hash, but only first 7 characters
   * - `{hashFull}`: commit hash
   * - `{pr}`: PR number, if not found, it will use `hash`
   * - `{autoLink}`: value of first match auto links, usually will be ticket number
   * - `{scope}`: commit scope, see `scopeNames`
   */
  item: ITemplate;
  /**
   * Scope names.
   *
   * For example, `feat(core): add something`, the scope is `core`.
   * This will replace the scope with the name in the object.
   *
   * @example { core: 'Core', ui: 'Web UI' }
   */
  scopeNames: KVPairs;
  /**
   * Pattern to ignore the commit.
   */
  ignored: string[];
  /**
   * Ignore commits that don't match any group.
   */
  ignoreOthers: boolean;
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
  /**
   * Priority of the group.
   *
   * If the commit matches multiple groups, the group with the highest priority will be used.
   * If two groups have the same priority, the first one will be used.
   *
   * @example 1
   * @default 0
   */
  priority?: number;
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
   * Something about PR's.
   */
  prs: ITagPR[];
  /**
   * Something about sorting the version.
   */
  sort: ITagSort;
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
   * - `{versionName}`: version name set in tag config
   * - `{ticket}`: ticket number
   *
   * @example Stable-{version}
   * @default {version}
   */
  title?: ITemplate;
  /**
   * Release body.
   *
   * Allowed variables:
   * - `{content}`: new version changelog body.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number
   *
   * @default {Ticket: "ticket"<NL><NL>}{content}
   */
  body?: ITemplate;
  /**
   * Is this a pre-release.
   */
  preRelease?: boolean;
  /**
   * Is this a draft release.
   */
  draft?: boolean;
}
/**
 * After tag is created, create PR's.
 */
export interface ITagPR {
  /**
   * Repository name.
   *
   * Format: `<owner>/<repo>`
   *
   * @default using `git remote get-url origin`, if not found, ignore this PR
   * @example `evan361425/version-bumper`
   */
  repo: string;
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
   * - `{versionName}`: version name set in tag config
   * - `{ticket}`: ticket number
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
   * - `{versionName}`: version name set in tag config
   * - `{ticket}`: ticket number
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
 * How to sort the version, using unix sort algorithm.
 */
export interface ITagSort {
  /**
   * Separator of the version.
   *
   * Same as the `-t` option in the `sort` command.
   *
   * @see https://man7.org/linux/man-pages/man1/sort.1.html
   */
  separator: string;
  /**
   * Field to sort.
   *
   * Same as the `-k` option in the `sort` command.
   * `KEYDEF[]`
   *
   * KEYDEF is F[.C][OPTS][,F[.C][OPTS]] for start and stop position,
   * where F is a field number and C a character position in the
   * field; both are origin 1, and the stop position defaults to the
   * line's end.  If neither -t nor -b is in effect, characters in a
   * field are counted from the beginning of the preceding whitespace.
   * OPTS is one or more single-letter ordering options [bdfMn].  If no key
   * is given, use the `n` (compare according to string numerical value) as the key.
   * If both OPTS has given, the last one will be used.
   *
   * @see https://man7.org/linux/man-pages/man1/sort.1.html
   * @example [['1,1n'], ['2,2n'], ['3,3n'], ['3,3a']]
   */
  fields: string[];
}
/**
 * Template settings.
 */
export interface ITemplate {
  /**
   * File path to the template file.
   *
   * Priority: 2
   */
  file?: string;
  /**
   * Plain text template.
   *
   * Priority: 1, last to be used.
   */
  value: string;
  /**
   * Query to get the template.
   *
   * Priority: 3, first to be used.
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
   * @default main
   */
  branch?: string;
  /**
   * File path to the template file.
   *
   * @example docs/TEMPLATE.md
   */
  path: string;
}
