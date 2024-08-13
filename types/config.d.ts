import type { UUID } from 'node:crypto';
import { DoAppSpec } from './do';

export interface Project {
  name: string;
  id: UUID;
  type?: string;
  created: Date;
  updated: Date;
  gitHubRepo?: string;
  description?: string;
  do_link?: string;
  do_app_id?: string;
  do_config?: DoAppSpec;
}

export type ProjectChoice = {
  name: string;
  value: string;
  description: string;
};

export interface Config {
  useEnvFile: boolean;
  envPath: string;
  projects: Project[];
}

export interface RequiredEnvs {
  GH_USERNAME: string;
  GH_TOKEN: string;
  DO_REGISTRY_NAME: string;
  DO_API_TOKEN: string;
}

export interface RequiredEnvsSet {
  GH_USERNAME: boolean;
  GH_TOKEN: boolean;
  DO_REGISTRY_NAME: boolean;
  DO_API_TOKEN: boolean;
}

export interface GHSecret {
  repo: string;
  secret_name: string;
  encrypted_value: string;
}

export type ProjectType = 'ts_express' | 'go_fiber';

export interface NewProjectQuestions {
  name: string;
  projectPath: string;
  description?: string;
  createDir: boolean;
  createGitRepo: boolean;
  createReadme: boolean;
  createGHRepo: boolean;
  createGHAction: boolean;
  createDoApp: boolean;
  projectType: ProjectType | null;
}
