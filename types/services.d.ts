import type { UUID } from 'crypto';
import { type FunctionConfiguration } from '@aws-sdk/client-lambda';

export interface ServiceType {
  name: string;
  id: UUID;
  description: string;
  requiredKeys: string[];
  fileLocation: string;
  value: string;
}

export interface FuncConfig extends FunctionConfiguration {
  url: string;
  internal_name: string;
}

export interface CreateFunctionConfig {
  name: string;
  code: string;
  handler?: string;
  runtime?: Runtime;
  environment?: Record<string, string>;
}
