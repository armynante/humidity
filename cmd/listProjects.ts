import { select, input, confirm } from '@inquirer/prompts';
import GitHub from '../helpers/github';
import {
  deleteProject,
  listProjects as listConfigProjects,
  updateProject,
  viewProject,
} from '../helpers/config';
import { deleteDoApp, deleteDoRegistryRepo } from '../helpers/digitalOcean';
import chalk from 'chalk';
import { exit } from 'process';
import { rmdir } from 'node:fs/promises';
import { buildProjectChoices, projectTable } from '../helpers/transformers';
import process from 'node:process';
const GitHubToken = process.env.GH_TOKEN;

/**
 * List projects screen in the CLI.
 * Show actions to view, update, or delete a project.
 */
const listProjects = async () => {
  const projects = await listConfigProjects();
  if (projects?.length === 0 || !projects) {
    console.log(
      chalk.whiteBright.bgRed.bold('No projects found. Create a new project.'),
    );
    return;
  }
  const [choices] = buildProjectChoices(projects);
  const selectedProject = await select({
    message: 'Select a project to view details:',
    choices: choices,
  });

  console.log(`Selected project: ${selectedProject}`);
  const project = await viewProject(selectedProject);

  const whatToDo = await select({
    message: 'What do you want to do?',
    choices: [
      { name: 'View details', value: 'details' },
      { name: 'Update description', value: 'update' },
      { name: 'Delete project', value: 'delete' },
      { name: 'Exit', value: 'exit' },
    ],
  });

  switch (whatToDo) {
    case 'details': {
      console.log('Viewing details...');
      const table = projectTable(project);
      console.log(table);
      break;
    }
    case 'update': {
      console.log('Updating project...');
      const newDescription = await input({
        message: 'Enter a new description:',
      });
      await updateProject(selectedProject, { description: newDescription });
      console.log('Project updated');
      await viewProject(selectedProject);
      break;
    }
    case 'delete': {
      console.log('Deleting project...');
      const conf = await confirm({
        message: `Are you sure you want to delete ${project.name}?`,
      });
      if (!conf) {
        console.log('Not deleting project');
        exit(0);
      }

      const inputResp = await input({
        message: 'Type the name of the project to confirm deletion:',
        required: true,
      });
      if (inputResp !== project.name) {
        console.log('Project names do not match. Not deleting project.');
        break;
      }

      // if there is a GitHub repo, ask if they want to archive it
      if (project.gitHubRepo) {
        const archive = await confirm({
          message: 'Do you want to delete the GitHub repository?',
        });
        if (archive) {
          if (!GitHubToken) {
            console.error('GitHub token not found');
          } else {
            const GH_USERNAME = process.env.GH_USERNAME;
            if (!GH_USERNAME) {
              console.error('GitHub username not found');
            } else {
              const GH = new GitHub(GitHubToken, GH_USERNAME);
              await GH.delete(project.name);
              console.log('GitHub repository deleted');
            }
          }
        }
      }

      // delete the DigitalOcean App if it exists
      if (project.do_app_id !== '' && project.do_app_id !== undefined) {
        const confDeleteDoApp = await confirm({
          message: 'Delete the DigitalOcean App?',
        });
        if (confDeleteDoApp) {
          const [, err] = await deleteDoApp(project.do_app_id);
          if (err) {
            console.error(err);
            return;
          }
          console.log('DigitalOcean App deleted');
        }

        //delete the DO registry repository
        const deleteDoRegistry = await confirm({
          message: 'Delete the DigitalOcean Registry repository?',
        });

        if (deleteDoRegistry) {
          console.log('Deleting DigitalOcean Registry repository...');
          // delete the repository
          const registry = process.env.DO_REGISTRY_NAME as string;
          if (!registry) {
            console.error('DO Registry name not found');
          } else {
            const [, e] = await deleteDoRegistryRepo(project.name, registry);
            if (e) {
              console.error(e);
            } else {
              console.log('DigitalOcean Registry repository deleted');
            }
          }
        }
      }

      const deleteProjectDir = await confirm({
        message: 'Delete the project directory?',
      });
      if (deleteProjectDir) {
        console.log('Deleting project directory...');
        // delete the project directory
        await rmdir(project.name, { recursive: true });
      }

      await deleteProject(selectedProject);
      exit(0);

      break;
    }
    case 'exit':
      console.log('Exiting...');
      exit(0);
      break;
    default:
      console.log('Invalid choice');
      exit(0);
      break;
  }
};

export default listProjects;
