import { select, confirm, input, password, checkbox } from '@inquirer/prompts';
import { ConfigService } from '../services/humidity/config/ConfigService.js';
import { EnvKeys } from '../types/enums.js';
const envKeyDescriptions = {
    [EnvKeys.GH_USERNAME]: 'GitHub Username',
    [EnvKeys.GH_TOKEN]: 'GitHub Token',
    [EnvKeys.DO_REGISTRY_NAME]: 'DigitalOcean Registry Name',
    [EnvKeys.DO_API_TOKEN]: 'DigitalOcean API Token',
    [EnvKeys.DO_SPACES_REGION]: 'DigitalOcean Spaces Region',
    [EnvKeys.DO_SPACES_ACCESS_KEY]: 'DigitalOcean Spaces API Key',
    [EnvKeys.DO_SPACES_SECRET_KEY]: 'DigitalOcean Spaces Secret Key',
    [EnvKeys.AMZ_ID]: 'AWS Access Key ID',
    [EnvKeys.AMZ_SEC]: 'AWS Secret Access Key',
    [EnvKeys.AMZ_REGION]: 'AWS Region',
};
export const settings = async (config, confService) => {
    const options = await select({
        message: 'Settings',
        choices: [
            {
                name: 'Create a config file',
                value: 'create',
                disabled: config !== false,
            },
            { name: 'Set environment variables', value: 'set_env' },
            { name: 'Exit', value: 'exit' },
        ],
    });
    switch (options) {
        case 'create': {
            // ... (existing create config file logic)
            break;
        }
        case 'set_env': {
            const useEnvFile = await confirm({
                message: 'Do you want to use an .env.humidity file to store secrets?',
            });
            let envPath = '';
            if (useEnvFile) {
                envPath = await input({
                    message: 'Where is your .env.humidity file to store secrets going to be live?',
                    default: '~/.humidity/.env',
                    validate: (path) => path.endsWith('.env') || 'Please enter a valid .env file',
                });
            }
            const variablesToSet = await checkbox({
                message: 'Select the environment variables you want to set:',
                choices: Object.entries(EnvKeys).map(([key, value]) => ({
                    name: `${envKeyDescriptions[value]} (${value})`,
                    value: value,
                })),
            });
            const userData = {};
            for (const variable of variablesToSet) {
                const isSecret = [
                    EnvKeys.GH_TOKEN,
                    EnvKeys.DO_API_TOKEN,
                    EnvKeys.DO_SPACES_ACCESS_KEY,
                    EnvKeys.DO_SPACES_SECRET_KEY,
                    EnvKeys.AMZ_ID,
                    EnvKeys.AMZ_SEC,
                ].includes(variable);
                const value = await (isSecret ? password : input)({
                    message: `Enter your ${envKeyDescriptions[variable]}:`,
                    required: true,
                });
                userData[variable] = value;
            }
            if (useEnvFile) {
                const [, err] = await confService.updateConfig({
                    envPath,
                    useEnvFile: true,
                });
                if (err) {
                    console.error(err);
                }
                else {
                    const envFile = await confService.buildEnvFile(envPath, userData);
                    console.log('Env file updated at:', envPath);
                }
            }
            else {
                console.log('Environment variables set for this session.');
                // Here you might want to set these variables for the current process
                // or store them in memory for later use in your application
            }
            break;
        }
        case 'exit': {
            console.log('Exiting...');
            break;
        }
    }
};
