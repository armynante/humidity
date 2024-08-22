import type { UUID } from 'node:crypto';
import { DoAppSpec } from './do';
import { ServiceType } from './service';

export interface Project {
  name: string;
  id: UUID;
  type?: string;
  created: Date | string;
  updated: Date | string;
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
  services: Service[];
}

export interface Service {
  name: string;
  internal_name: string;
  config: Record<string, any>;
  url: string;
  id: UUID;
  apiId: string;
  updated: Date | string;
  created: Date | string;
  serviceType: ServiceType;
}

export interface RequiredEnvs {
  GH_USERNAME?: string;
  GH_TOKEN?: string;
  DO_REGISTRY_NAME?: string;
  DO_API_TOKEN?: string;
  DO_SPACES_REGION?: string;
  DO_SPACES_ACCESS_KEY?: string;
  DO_SPACES_SECRET_KEY?: string;
  AMZ_ID?: string;
  AMZ_SEC?: string;
  AMZ_REGION?: string;
}

export enum EnvKeys {
  GH_USERNAME = 'GH_USERNAME',
  GH_TOKEN = 'GH_TOKEN',
  DO_REGISTRY_NAME = 'DO_REGISTRY_NAME',
  DO_API_TOKEN = 'DO_API_TOKEN',
  DO_SPACES_REGION = 'DO_SPACES_REGION',
  DO_SPACES_ACCESS_KEY = 'DO_SPACES_ACCESS_KEY',
  DO_SPACES_SECRET_KEY = 'DO_SPACES_SECRET_KEY',
  AMZ_ID = 'AMZ_ID',
  AMZ_SEC = 'AMZ_SEC',
  AMZ_REGION = 'AMZ_REGION',
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
  buildTool: string | null;
  prettier: boolean;
  eslint: boolean;
}
