import type { UUID } from 'node:crypto';
import { DoAppSpec } from './do';
import { ServiceType } from './service';
import type { TemplateType } from './services';

// A Project is an empty repo that can be deployed using a specific language/framework
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
  templates: TemplateType[];
}

// A Service is an instance of a template that has been deployed
// It is different from a Project. It is meant to be a reusable component
// us
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

// ... existing code ...

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

export interface RequiredEnvs {
  [EnvKeys.GH_USERNAME]?: string;
  [EnvKeys.GH_TOKEN]?: string;
  [EnvKeys.DO_REGISTRY_NAME]?: string;
  [EnvKeys.DO_API_TOKEN]?: string;
  [EnvKeys.DO_SPACES_REGION]?: string;
  [EnvKeys.DO_SPACES_ACCESS_KEY]?: string;
  [EnvKeys.DO_SPACES_SECRET_KEY]?: string;
  [EnvKeys.AMZ_ID]?: string;
  [EnvKeys.AMZ_SEC]?: string;
  [EnvKeys.AMZ_REGION]?: string;
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
