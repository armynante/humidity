import type { Project, ProjectChoice } from "../types/config";
import Table from 'cli-table3';

/**
 * Builds a list of project choices for the user to select from
 * using the inquirer select prompt
 * @param projects The projects to build choices from
 * @returns {[Array, error]} The list of choices
 */
export const buildProjectChoices = (projects: Project[]): [Array<ProjectChoice>, string | null] => {
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
    return [[], "There was an error building project choices"];
  }
};

/**
 * Builds a table from a project object
 * @param project The project object to build the table from
 * @returns {string} The table
 */
export const projectTable = (project: Project):string => {
  const table = new Table();
      const updated = new Date(project.updated);
      const created = new Date(project.created);
      table.push(
        { 'Project ID': project.id },
        { 'Name': project.name },
        { 'Type': project.type },
        { 'Description': project.description },
        { 'Created': created.toLocaleString() },
        { 'Updated': updated.toLocaleString() },
        { 'GitHub Repo': project.gitHubRepo },
        { 'DigitalOcean Link': project.do_link },
        { 'DigitalOcean App ID': project.do_app_id },
      );
      return table.toString();
};