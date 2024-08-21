import chalk from 'chalk';
import type {
  NewProjectQuestions,
  Project,
  ProjectChoice,
  Service,
} from '../types/config';
import Table from 'cli-table3';
import { exit } from 'node:process';

/**
 * Builds a list of project choices for the user to select from
 * using the inquirer select prompt
 * @param projects The projects to build choices from
 * @returns {[Array, error]} The list of choices
 */
export const buildProjectChoices = (
  projects: Project[],
): [Array<ProjectChoice>, string | null] => {
  try {
    const choices = projects.map((project: Project) => {
      const date = new Date(project.created);
      return {
        name: project.name,
        value: project.id,
        description: `Created: ${date.toLocaleString()} | description: ${project.description}`,
      };
    }, []);
    return [choices, null];
  } catch (error) {
    console.error(error);
    return [[], 'There was an error building project choices'];
  }
};

function getColor(value: boolean) {
  return value ? chalk.greenBright.bold : chalk.redBright.bold;
}

/**
 * Builds a table from a project object
 * @param project The project object to build the table from
 * @returns {string} The table
 */
export const projectTable = (project: Project): string => {
  const table = new Table();
  const updated = new Date(project.updated);
  const created = new Date(project.created);
  table.push(
    { 'Project ID': project.id },
    { Name: project.name },
    { Type: project.type },
    { Description: project.description },
    { Created: created.toLocaleString() },
    { Updated: updated.toLocaleString() },
    { 'GitHub Repo': project.gitHubRepo },
    { 'DigitalOcean Link': project.do_link },
    { 'DigitalOcean App ID': project.do_app_id },
  );
  return table.toString();
};

export const ServiceTable = (service: Service): string => {
  const table = new Table();
  const updated = new Date(service.updated);
  const created = new Date(service.created);
  table.push(
    { 'Service ID': service.id },
    { Name: service.name },
    { Type: service.serviceType },
    { URL: service.url },
    { Created: created.toLocaleString() },
    { Updated: updated.toLocaleString() },
  );
  return table.toString();
};

export const showErrorAndExit = (message: string): never => {
  console.log(chalk.whiteBright.bgRed.bold(message));
  exit(1);
};

export function formatSummary(project: NewProjectQuestions): string {
  const labels = [
    'Name',
    'Description',
    'Path',
    'Create directory',
    'Create Git repo',
    'Create README',
    'Create GitHub repo',
    'Create GitHub action',
    'Create DO App',
    'Project type',
  ];

  const values = [
    project.name,
    project.description,
    project.projectPath,
    getColor(project.createDir)(project.createDir.toString()),
    getColor(project.createGitRepo)(project.createGitRepo.toString()),
    getColor(project.createReadme)(project.createReadme.toString()),
    getColor(project.createGHRepo)(project.createGHRepo.toString()),
    getColor(project.createGHAction)(project.createGHAction.toString()),
    getColor(project.createDoApp)(project.createDoApp.toString()),
    project.projectType,
    project.buildTool,
    project.prettier,
    project.eslint,
  ];

  const maxLength = labels.reduce(
    (max, label) => Math.max(max, label.length),
    0,
  );
  const formattedLines = labels.map(
    (label, i) => `${label.padStart(maxLength, ' ')}: ${values[i]}`,
  );
  const summaryHeader = '='.repeat(
    Math.max(...formattedLines.map((line) => line.length)),
  );

  return [
    summaryHeader,
    '//// Project Summary',
    summaryHeader,
    ...formattedLines,
    summaryHeader,
    '\n',
  ].join('\n');
}
