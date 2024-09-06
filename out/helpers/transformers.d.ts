import type { NewProjectQuestions, Project, ProjectChoice, Service } from '../types/config';
/**
 * Builds a list of project choices for the user to select from
 * using the inquirer select prompt
 * @param projects The projects to build choices from
 * @returns {[Array, error]} The list of choices
 */
export declare const buildProjectChoices: (projects: Project[]) => [Array<ProjectChoice>, string | null];
/**
 * Builds a table from a project object
 * @param project The project object to build the table from
 * @returns {string} The table
 */
export declare const projectTable: (project: Project) => string;
export declare const ServiceTable: (service: Service) => string;
export declare const showErrorAndExit: (message: string) => never;
export declare function formatSummary(project: NewProjectQuestions): string;
