import ora from "ora";
import got from "got";

const TOKEN = process.env.AUTH_TOKEN;

if (!TOKEN) {
  throw new Error("AUTH_TOKEN required");
}

// TODO: Pass them
const organization = "";
const project = "";

if (!organization || !project) {
  throw new Error('project and organization are required');
}

const client = got.extend({
  prefixUrl: "https://sentry.io/api/0/",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
  },
});

export const fetchEvent = async (eventId) => {
  const spinner = ora(`Fetching data for event ${eventId}`).start();

  try {
    const event = await client.get(`projects/${organization}/${project}/events/${eventId}/json/`).json();
    spinner.succeed(`Event fetched successfully`);
    return event;
  } catch (e) {
    spinner.fail(`Could not retrieve event: ${e}`);
    throw new Error("exit"); // TODO: Replace with process.exit(1);
  }
};

export const fetchReleaseArtifacts = async (release) => {
  const spinner = ora(`Fetching artifacts for release ${release}`).start();

  try {
    const event = await client.get(`projects/${organization}/${project}/releases/${release}/files/`).json();
    spinner.succeed(`Artifacts fetched successfully`);
    return event;
  } catch (e) {
    spinner.fail(`Could not retrieve artifacts for ${release}: ${e}`);
    throw new Error("exit"); // TODO: Replace with process.exit(1);
  }
};

export const fetchReleaseArtifactFile = async (release, artifact) => {
  const spinner = ora(`Fetching file ${artifact.name} from release ${release}`).start();

  try {
    const file = await client
      .get(`projects/${organization}/${project}/releases/${release}/files/${artifact.id}/?download=1`)
      .text();
    spinner.succeed(`Release file fetched successfully`);
    return file;
  } catch (e) {
    spinner.fail(`Could not retrieve file ${artifact.name} from release ${release}: ${e}`);
    throw new Error("exit"); // TODO: Replace with process.exit(1);
  }
};

export const fetchReleaseArtifactFileMetadata = async (release, artifact) =>
  client.get(`projects/${organization}/${project}/releases/${release}/files/${artifact.id}/`).json();
