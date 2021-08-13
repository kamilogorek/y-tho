import chalk from "chalk";
import {
  fetchEvent,
  fetchReleaseArtifacts,
  fetchReleaseArtifactFile,
  fetchReleaseArtifactFileMetadata,
} from "./api.js";
import {
  verifyEventIsNotAlreadyMapped,
  verifyReleaseNameIsPresent,
  verifyExceptionIsPresent,
  verifyStacktraceIsPresent,
  verifyStacktraceFramePath,
  verifyArtifacts,
  findMatchingArtifact,
  verifyDistsMatches,
  discoverSourceMapsLocation,
  printResolvedSourcemap,
} from "./steps.js";

const EVENT_ID = process.env.EVENT_ID || "d2ffe01827d243a8bc7da05f701b0ef5";

if (!EVENT_ID) {
  throw new Error("EVENT_ID required");
}

// TODO: CLI/User input
// TODO: Refactor/better naming
// TODO: Better error messages and tips
// TODO: Support inlined sourcemaps

async function ytho(eventId) {
  console.log("");

  const event = await fetchEvent(eventId);

  await verifyReleaseNameIsPresent(event);
  await verifyExceptionIsPresent(event);

  // NOTE: For testing purpose only
  // event.exception.values[0].stacktrace = event.exception.values[0].raw_stacktrace;

  // verifyEventIsNotAlreadyMapped(event);

  await verifyStacktraceIsPresent(event);
  const frame = await verifyStacktraceFramePath(event);
  const artifacts = await fetchReleaseArtifacts(event.release);

  verifyArtifacts(artifacts);

  const sourceArtifact = await findMatchingArtifact(artifacts, frame.abs_path);
  await verifyDistsMatches(sourceArtifact, event.dist);

  const file = await fetchReleaseArtifactFile(event.release, sourceArtifact);
  const fileMetadata = await fetchReleaseArtifactFileMetadata(event.release, sourceArtifact);

  const sourceMapsLocation = await discoverSourceMapsLocation(file, fileMetadata);
  const sourceMapsArtifact = await findMatchingArtifact(artifacts, sourceMapsLocation);
  await verifyDistsMatches(sourceMapsArtifact, event.dist);

  const sourceMapsFile = await fetchReleaseArtifactFile(event.release, sourceMapsArtifact);

  await printResolvedSourcemap(sourceMapsFile, frame.lineno, frame.colno);

  console.log(chalk.green("\nSource Maps should be working fine. Have you tried turning it off and on again?\n"));
}

await ytho(EVENT_ID);
