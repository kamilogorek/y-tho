import ora from "ora";
import chalk from "chalk";
import { stripIndents } from "common-tags";
import { basename, dirname, extname, join } from "path";
import { SourceMapConsumer } from "source-map";

const exit = () => {
  process.exit(1);
};
const sleep = async () => new Promise((resolve) => setTimeout(resolve, 500));
const tip = (message) => console.log(chalk.yellow(stripIndents(message)));

const getInAppStacktraceFrames = (event) => event.exception.values[0].stacktrace.frames.filter((f) => f.in_app);

export const verifyReleaseNameIsPresent = async (event) => {
  const spinner = ora("Verifying release name").start();
  const { release } = event;

  if (!release) {
    spinner.fail(`Event is missing a release name`);
    tip(
      `Configure 'release' option in the SDK.
      https://docs.sentry.io/platforms/javascript/configuration/options/#release
      https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-a-release-is-configured-in-your-sdk`
    );
    exit();
  }

  await sleep();
  spinner.succeed(`Event has release name set to: ${release}`);
};

export const verifyExceptionIsPresent = async (event) => {
  const spinner = ora("Verifying event exception").start();
  const { exception } = event;

  if (!exception) {
    spinner.warn(`Event has no exception captured, there is no use for source maps`);
    exit();
  }

  await sleep();
  spinner.succeed(`Event exception present`);
};

export const verifyStacktraceIsPresent = async (event) => {
  const spinner = ora("Verifying exception stacktrace").start();
  const { stacktrace } = event.exception.values[0];

  if (!stacktrace) {
    spinner.fail(`Event exception has no stacktrace available`);
    exit();
  }

  await sleep();
  spinner.succeed(`Event exception stacktrace present`);
};

export const verifyEventIsNotAlreadyMapped = async (event) => {
  const spinner = ora("Verifying event is not already source mapped").start();
  const { raw_stacktrace } = event.exception.values[0];

  if (raw_stacktrace) {
    spinner.warn(`Event is already source mapped`);
    exit();
  }

  await sleep();
  spinner.succeed(`Event is not source mapped yet, proceeding`);
};

export const verifyStacktraceFramePath = async (event) => {
  const spinner = ora("Verifying exception stacktrace frames").start();
  const frames = getInAppStacktraceFrames(event);

  if (!frames.length) {
    spinner.fail(`Event exception stacktrace has no in_app frames`);
    exit();
  }

  const frame = frames[frames.length - 1];

  let absPath;

  try {
    absPath = new URL(frame.abs_path);
    await sleep();
    spinner.succeed(`Event has a valid stacktrace`);
  } catch {
    spinner.fail(
      `Event exception stacktrace top frame has incorrect abs_path (valid url is required). Found ${frame.abs_path}`
    );
    exit();
  }

  if (!extname(absPath.pathname)) {
    spinner.warn(
      `Top frame of event exception originates from the <script> tag, its not possible to resolve source maps`
    );
    exit();
  }

  return frame;
};

export const verifyArtifacts = async (artifacts) => {
  const spinner = ora("Verifying artifacts").start();

  if (!artifacts.length) {
    spinner.fail(`Release has no artifacts uploaded`);
    tip(`https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifacts-are-uploaded`);
    exit();
  }

  await sleep();
  spinner.succeed(`Release has artifacts present`);
};

export const findMatchingArtifact = async (artifacts, absPath) => {
  const spinner = ora("Verifying frame artifact").start();

  let filename;
  try {
    const { pathname } = new URL(absPath);
    filename = join("~", pathname);
  } catch {
    filename = join("~", absPath);
  }

  const fullMatch = artifacts.find((a) => a.name === `${filename}`);
  const partialMatch = artifacts.find((a) => a.name.endsWith(basename(filename)));

  if (!fullMatch) {
    spinner.fail(`Artifacts do not include entry: ${filename}`);
    if (partialMatch) {
      tip(
        `Found entry with matching filename: ${partialMatch.name}
        Make sure that that --url-prefix is set to: ${dirname(filename)} and not ${dirname(partialMatch.name)}
        https://docs.sentry.io/product/cli/releases/#sentry-cli-sourcemaps`
      );
    }
    tip(
      `https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifact-names-match-stack-trace-frames`
    );
    exit();
  }

  await sleep();
  spinner.succeed(`Artifacts include required sourcemap file`);
  return fullMatch;
};

export const verifyDistsMatches = async (artifact, dist) => {
  const spinner = ora("Verifying release artifact distribution").start();

  if (artifact.dist !== dist) {
    spinner.fail(`Release artifact distrubition mismatch. Event: ${dist}, Artifact: ${artifact.dist}`);
    tip(
      `Configure 'dist' option in the SDK to match the one used during artifacts upload.
      https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/#verify-artifact-distribution-value-matches-value-configured-in-your-sdk`
    );
    exit();
  }

  await sleep();
  spinner.succeed(`Release artifact distribution set correctly`);
};

// https://github.com/getsentry/sentry/blob/623c2f5f3313e6dc55e08e2ae2b11d8f90cdbece/src/sentry/lang/javascript/processor.py#L145-L207
export const discoverSourceMapsLocation = async (file, fileMetadata) => {
  const spinner = ora(`Discovering source maps url`).start();

  let sourcemap;

  if (fileMetadata.headers["Sourcemap"]) {
    sourcemap = fileMetadata.headers["Sourcemap"];
  }

  if (!sourcemap && fileMetadata.headers["X-SourceMap"]) {
    sourcemap = fileMetadata.headers["X-SourceMap"];
  }

  if (!sourcemap) {
    for (const line of file.split("\n").reverse()) {
      const preamble = line.slice(0, 21);
      if (["//# sourceMappingURL=", "//@ sourceMappingURL="].includes(preamble)) {
        const possibleSourcemap = line.slice(21).trim();
        if (possibleSourcemap.startsWith("data:application/json")) {
          // TODO: Inline support
          spinner.warn(
            `Found inlined source maps, this tool doesnt support further verification yet for this scenario`
          );
          exit();
        }
        sourcemap = possibleSourcemap;
        break;
      }
    }
  }

  if (sourcemap) {
    await sleep();
    spinner.succeed(`Source maps url discovered: ${sourcemap}`);
    return sourcemap;
  }

  spinner.fail(`Failed to discover source maps url`);
  exit();
};

function printSourcemapContent(text, line, column) {
  const lines = text.split("\n");
  const begin = Math.max(0, line - 4);
  const end = Math.min(line + 2, lines.length - 1);
  const slice = lines.slice(begin, end + 1);
  slice.splice(line - begin, 0, "^".padStart(column + 1));
  return slice.join("\n");
}

export const printResolvedSourcemap = async (sourcemap, line, column) => {
  const spinner = ora(`Resolving source maps position`).start();
  try {
    const consumer = await new SourceMapConsumer(sourcemap);
    const position = consumer.originalPositionFor({ line, column });
    const source = consumer.sourceContentFor(position.source);
    const content = printSourcemapContent(source, position.line, position.column);
    await sleep();
    spinner.succeed(`Source maps position resolved`);
    console.log(`\n------------------------------------------------`);
    console.log(content);
    console.log(`------------------------------------------------`);
  } catch (e) {
    spinner.fail(`Could not resolve source maps position ${e}`);
    exit();
  }
};
