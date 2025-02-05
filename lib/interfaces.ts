/**
 * Configuration of the bumper.
 */
export interface IConfig {
  repo?: IRepo;
  process?: IProcess;
  hook?: IHook;
  changelog?: IChangelog;
  autoLinks?: IAutoLink[];
  pr?: IPR;
  diff?: IDiff;
  tags?: ITag[];
}

// export type KVPairs = Record<string, string>;

/**
 * Repository settings.
 */
export interface IRepo {
  /**
   * Link to the repository, it will use for tags in Changelog.
   *
   * @default 'using `git remote get-url origin`, if not found throw exception'
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
   * It will then try to tag the new version.
   */
  bump?: boolean;
  /**
   * Push all commits and tags.
   */
  push?: boolean;
  /**
   * Create PR in tags, and `tags[].prBranches` must be set
   */
  pr?: boolean;
  /**
   * Create release in tags, and `tags[].release` must be set
   */
  release?: boolean;
  /**
   * Throw error if tag already exists in local.
   */
  checkTag?: boolean;
  /**
   * Throw error if tag already exists in remote.
   */
  checkRemoteTag?: boolean;
  /**
   * Ask for the ticket number if not found.
   */
  wantedTicket?: boolean;
  /**
   * Ask for verification of the changelog content.
   */
  askToVerifyContent?: boolean;
  /**
   * Ask to choose which tag pattern to bump if multiple tags found.
   */
  askToChooseTag?: boolean;
  /**
   * Use semantic commit message to map the `diff.groups`.
   *
   * - `^fix` as `Fixed`
   * - `^feat`, `^add` as `Added`
   * - `^[\w\(\)]+!`, `BREAKING CHANGE` as `Changed`, with priority 1
   *
   * @see https://www.conventionalcommits.org/en/v1.0.0/
   */
  useSemanticGroups?: boolean;
  /**
   * Add semantic tag naming to `tags`.
   *
   * - Use pattern `v[0-9]+.[0-9]+.[0-9]+` and name `semantic`.
   * - Enable release with default title and body, see default from `tags[].release`.
   * - Enable changelog.
   *
   * @see https://semver.org/
   */
  useSemanticTag?: boolean;
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
  useReleaseCandidateTag?: boolean;
}
/**
 * Commands to run before and after the process.
 */
export interface IHook {
  /**
   * Commands to run after version is verified.
   *
   * Each string will be separated by space except the string inside the quotes.
   * This will be run even in debug mode and not support templating as `Template`.
   *
   * Command exit code must be 0 to continue the process.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   *
   * @example ['echo "version: {version}"']
   */
  afterVerified?: string[];

  /**
   * Commands to run after all the process is done.
   *
   * Each string will be separated by space except the string inside the quotes.
   * This will be run even in debug mode and not support templating as `Template`.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   *
   * @example ['echo "version: {version}"']
   */
  afterAll?: string[];
}
/**
 * Changelog settings.
 */
export interface IChangelog {
  /**
   * Enable changelog generation.
   */
  enable?: boolean;
  /**
   * File path to the changelog file.
   */
  destination?: string;
  /**
   * Destination of changelog when in debug mode.
   *
   * @example 'CHANGELOG.debug.md'
   * @default '`destination` with `.debug` suffix before the extension'
   */
  destinationDebug?: string;
  /**
   * The changelog of specific version.
   *
   * Default will prepend `## ` before the first line.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{content}`: new version changelog body from `diff`.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number
   * - `{date}`: current date, format is `YYYY-MM-DD`
   * - `{time}`: current time, format is `HH:mm:ss`
   */
  section?: ITemplate;
  /**
   * After update the changelog, commit the changes.
   */
  commit?: IChangelogCommit;
}
/**
 * How to commit the changelog.
 */
export interface IChangelogCommit {
  /**
   * Commit message template.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   */
  message?: ITemplate;
  /**
   * Execute `git add .` not only the changelog.
   */
  addAll?: boolean;
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
   * Only allow characters `[a-zA-Z0-9-_]` and have special variables:
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
   * Extract auto link from the content.
   */
  extract(content: string): IAutoLinkMatch | undefined;
}
/**
 * Pull Request global settings, custom setting can be found in `tags[].prs`.
 */
export interface IPR {
  /**
   * Repository name.
   *
   * Format: `<owner>/<repo>`
   *
   * @default 'using `git remote get-url origin`, if not found, ignore this PR'
   * @example `evan361425/version-bumper`
   */
  repo?: string;
  /**
   * Source branch.
   *
   * Allowed variables:
   * - `{name}`: tag name
   * - `{timestamp}`: current timestamp
   *
   * This will create the branch if not exists.
   *
   * @example 'master'
   */
  head?: string;
  /**
   * Where to create the head branch.
   *
   * If this is not set, it will not create the head branch and use it directly to create the PR.
   *
   * Allowed variables:
   * - `{name}`: tag name
   *
   * @example 'main'
   */
  headFrom?: string;
  /**
   * Target branch.
   *
   * Allowed variables:
   * - `{name}`: tag name
   *
   * @example `deploy/{name}`
   */
  base?: string;
  /**
   * Labels to add to the PR.
   */
  labels?: string[];
  /**
   * Reviewers to add to the PR.
   */
  reviewers?: string[];
  /**
   * PR's title template.
   *
   * This will trim the title to 100 characters and append `...` if it's too long.
   * Will replace new line with space and trim the title before use.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   */
  title?: ITemplate;
  /**
   * PR's body template.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config, empty if not set
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   * - `{content}`: changelog content
   * - `{diffLink}`: link to the diff of this version
   */
  body?: ITemplate;
}
/**
 * Auto generate release notes.
 */
export interface IDiff {
  /**
   * How to group the commits.
   */
  groups?: IDiffGroup[];
  /**
   * Title of the group that doesn't match any group.
   *
   * If `ignoreOthers` is enabled, this will not be used.
   *
   * @example Others
   */
  othersTitle?: string;
  /**
   * Template of single list item.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{title}`: commit title after `:` add will remove all the pr number and autoLink if found
   * - `{titleTail}`: commit title after `:`
   * - `{titleFull}`: full commit title, which is the first line of the commit message
   * - `{author}`: commit author
   * - `{hash}`: commit hash, but only first 7 characters
   * - `{hashLink}`: commit hash with link, like `[hash](link)`
   * - `{hashFull}`: commit hash
   * - `{pr}`: PR number
   * - `{prLink}`: PR number with link, like `[PR](link)`
   * - `{autoLink}`: value of first match auto links, usually will be ticket number
   * - `{scope}`: commit scope, see `scopeNames`
   */
  item?: ITemplate;
  /**
   * Scope names.
   *
   * For example, `feat(core): add something`, the scope is `core`.
   * This will replace the scope with the name in the object.
   *
   * @example { core: 'Core', ui: 'Web UI' }
   */
  scopeNames?: Record<string, string>;
  /**
   * Pattern to ignore the commit.
   */
  ignored?: string[];
  /**
   * Ignore commits that don't match any group.
   */
  ignoreOthers?: boolean;
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
   * @default ''
   */
  name?: string;
  /**
   * Regular Expression pattern to match the tag.
   *
   * @example v[0-9]+.[0-9]+.[0-9]+-rc[0-9]+
   */
  pattern?: string;
  /**
   * Should use this tag to generate changelog.
   *
   * @default true
   */
  withChangelog?: boolean;
  /**
   * Something about GitHub Release.
   */
  release?: IRelease;
  /**
   * Something about PR's.
   */
  prs?: ITagPR[];
  /**
   * Something about sorting the version.
   */
  sort?: ITagSort;
}
/**
 * GitHub Release settings.
 */
export interface IRelease {
  /**
   * Enable GitHub Release.
   *
   * @default true
   */
  enable?: boolean;
  /**
   * Title of the release.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   *
   * @example 'Stable-{version}'
   * @default '{version}'
   */
  title?: ITemplate;
  /**
   * Release body.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{content}`: new version changelog body.
   * - `{version}`: current version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{diffLink}`: link to the diff of this version
   * - `{ticket}`: ticket number
   *
   * @default '{Ticket: "ticket"<NL><NL>}{content}'
   */
  body?: ITemplate;
  /**
   * Is this a pre-release.
   *
   * @default false
   */
  preRelease?: boolean;
  /**
   * Is this a draft release.
   *
   * @default false
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
   * see pr.repo
   *
   * @see IPR.repo
   */
  repo?: string;
  /**
   * Source branch.
   *
   * see pr.head
   *
   * @see IPR.head
   */
  head?: string;
  /**
   * Where to create the head branch.
   *
   * see pr.headFrom
   *
   * @see IPR.headFrom
   */
  headFrom?: string;
  /**
   * Target branch.
   *
   * see pr.base
   *
   * @see IPR.base
   */
  base?: string;
  /**
   * Labels to add to the PR.
   */
  labels?: string[];
  /**
   * Reviewers to add to the PR.
   */
  reviewers?: string[];
  /**
   * PR title template.
   *
   * Same as `pr.title`, but this will override the tag's `pr.title`.
   *
   * see pr.title
   *
   * @see IPR.title
   */
  title?: ITemplate;
  /**
   * What content to replace in the head branch.
   *
   * Remember to set `headFrom` if you want to create a new branch.
   */
  replacements?: IPRReplace[];
  /**
   * Commit message template.
   *
   * If not set, it will use the message in `tag.prBranches[].replacements[].commitMessage`.
   * One of them must be set.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   *
   * @default 'chore: bump to {version}'
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
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   */
  commitMessage?: ITemplate;
  /**
   * File path to replace.
   */
  paths: string[];
  /**
   * Regular Expression pattern to find the text and replace it by `replacement`.
   *
   * If this is not set, the whole tag config will be ignored.
   *
   * @example `version: [0-9]+.[0-9]+.[0-9]+$`
   */
  pattern: string;
  /**
   * Replacement string.
   *
   * Allowed variables:
   * - `{repo}`: repository link, see `repo.link`
   * - `{version}`: version number
   * - `{versionName}`: version name set in tag config
   * - `{versionLast}`: last version number
   * - `{ticket}`: ticket number
   *
   * @example `version: {version}`
   */
  replacement: ITemplate;
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
   * @default '.'
   */
  separator?: string;
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
   * @example ['1,1n', '2,2n', '3,3n', '3,3a']
   * @default ['1,1n']
   */
  fields?: string[];
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
  value?: string;
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
   * @example 'master'
   * @default 'main'
   */
  branch?: string;
  /**
   * File path to the template file.
   *
   * @example docs/TEMPLATE.md
   */
  path: string;
}
export type IAutoLinkMatch = {
  /**
   * Hit pattern
   */
  hit: string;
  /**
   * Matched prefix
   */
  prefix: string;
  /**
   * Auto link key
   *
   * @example ABC-123
   */
  target: string;
  /**
   * Formatted (replaced <num>) link
   */
  link: string;
};

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
