import { EnvKeys } from '../types/enums';

// pluck a subset of envs from the the EnvKeys enum and return as an array
export const pluckEnvs = (keys: EnvKeys[]) => {
  return keys
    .map((key) => process.env[key])
    .filter((env) => env !== undefined) as string[];
};

// list all envs in the EnvKeys enum
export const listEnvs = () => {
  return Object.values(EnvKeys).map((key) => key);
};
