import { select, confirm, input, password } from '@inquirer/prompts';
import { ConfigService } from '../services/ConfigService/ConfigService';
import type { Config } from '../types/config';
import { spawn } from 'node:child_process';

export const settings = async (
  config: Config | boolean,
  confService: ConfigService,
) => {
  const options = await select({
    message: 'Settings',
    choices: [
      {
        name: 'Create a config file',
        value: 'create',
        disabled: config !== false,
      },
      { name: 'Exit', value: 'exit' },
    ],
  });

  switch (options) {
    case 'create': {
      // Ask if the user wants to use an .env file to store secrets
      // fot things like GitHub tokens and the DigitalOcean API key
      const setEnvPath = await confirm({
        message:
          'Do you want to use an .env.humidity file to store secrets? \n If you select NO, you will be prompted to enter secrets each time you run a command.\n',
      });
      if (setEnvPath) {
        const envPath = await input({
          message:
            'Where is your .env.humidity file to store secrets going to be live?\n',
          default: '~/.humidity/.env',
          validate: (path) => {
            if (!path.endsWith('.env')) {
              return 'Please enter a valid .env file';
            }
            return true;
          },
        });
        // Create the .env file
        const [, err] = await confService.updateConfig({
          envPath,
          useEnvFile: true,
        });
        if (err) {
          console.error(err);
        }
        // Ask if they want to create the .env file
        const createEnv = await confirm({
          message: 'Do you want to create the .env.humidity file now?',
        });
        if (createEnv) {
          // create the .env file
          const GH_USERNAME = await input({
            message: 'Enter your GitHub username:',
            required: true,
          });
          const GH_TOKEN = await password({
            message: 'Enter your GitHub token:',
          });
          const DO_REGISTRY_NAME = await input({
            message:
              'Enter your DigitalOcean registry name? This is the name of the repository you want to use for your Docker images:',
            required: true,
          });
          const DO_API_TOKEN = await password({
            message: 'Enter your DigitalOcean API token:',
          });
          const DO_SPACES_REGION = await input({
            message: 'Enter your DigitalOcean Spaces region:',
            required: true,
            default: 'nyc3',
          });
          const DO_SPACES_ACCESS_KEY = await password({
            message: 'Enter your DigitalOcean Spaces API key:',
          });
          const DO_SPACES_SECRET_KEY = await password({
            message: 'Enter your DigitalOcean Spaces secret key:',
          });
          const AMZ_ID = await password({
            message: 'Enter your AWS access key ID:',
          });
          const AMZ_SEC = await password({
            message: 'Enter your AWS secret access key:',
          });
          const userData = {
            GH_USERNAME,
            GH_TOKEN,
            DO_REGISTRY_NAME,
            DO_API_TOKEN,
            DO_SPACES_REGION,
            DO_SPACES_ACCESS_KEY,
            DO_SPACES_SECRET_KEY,
            AMZ_ID,
            AMZ_SEC,
          };
          const envFile = await confService.buildEnvFile(envPath, userData);
          console.log('Env file created at:', envPath);
        }
      }
      break;
    }
    case 'exit': {
      console.log('Exiting...');
      break;
    }
  }
};
