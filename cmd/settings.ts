import { select, confirm, input } from '@inquirer/prompts';
import {
  checkConfigExists,
  createConfig,
  updateConfig,
} from '../helpers/config';
import { join } from 'node:path';

// Settings Interface
interface Settings {
  githubUsername: string | null;
}

// check if the settings file exists
const config = await checkConfigExists();

const options = await select({
  message: 'Settings',
  choices: [
    { name: 'Create a config file', value: 'create', disabled: !config },
    { name: 'Exit', value: 'exit' },
  ],
});

switch (options) {
  case 'create': {
    const confirmCreate = await confirm({
      message: 'Create a config file at ~/.humidity/config.json?',
    });
    const config = await createConfig();
    console.log('Config created');
    // Ask if the user wants to use an .env file to store secrets
    // fot things like GitHub tokens and the DigitalOcean API key
    const setEnvPath = await confirm({
      message:
        'Do you want to use an .env.humidity file to store secrets? \n If ypu select NO, you will be prompted to enter secrets each time you run a command.',
    });
    if (setEnvPath) {
      const envPath = await input({
        message:
          'Where is your .env.humidity file to store secrets going to be live?',
        default: '~/.humidity/.env.humidity',
        validate: (path) => {
          if (!path.endsWith('.env')) {
            return 'Please enter a valid .env file';
          }
          return true;
        },
      });
      const [, err] = await updateConfig({ envPath, useEnvFile: true });
      if (err) {
        console.error(err);
      }
      // Ask if they want to create the .env file
      const createEnv = await confirm({
        message: 'Do you want to create the .env.humidity file now?',
      });
      if (createEnv) {
        // create the .env file
        const envFile = Bun.file(envPath);
        if (!(await envFile.exists())) {
          // create the file using the .env.humidity.example file
          const envExample = Bun.file(
            join(__dirname, '../.env.humidity.example'),
          );
        }
        console.log('Env file created at', envPath);
        console.log('You can now add your secrets to the file');
      }
    }
    break;
  }
  case 'exit': {
    console.log('Exiting...');
    break;
  }
}
