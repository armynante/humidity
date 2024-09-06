import type { UUID } from 'node:crypto';
import { type FunctionConfiguration } from '@aws-sdk/client-lambda';

export interface TemplateType {
  name: string; //  Human readable name
  id: UUID;
  description: string;
  requiredKeys: string[]; // The keys that are required to be set in the config to use the template
  fileLocation: string; // The location of the template file to be deployed
  internal_name: string; // the name used to reference the template in the config
  deploy_file_location: string; // The location of the deploy file to be deployed
}

export interface ServiceType extends TemplateType {
  name: string;
  id: UUID;
  template: TemplateType;
}

export interface FuncConfig extends FunctionConfiguration {
  url: string;
  internal_name: string;
  apiId: string;
}

export interface CreateFunctionConfig {
  name: string;
  code: string;
  handler?: string;
  runtime?: Runtime;
  environment?: Record<string, string>;
}
