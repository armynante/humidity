import { select, confirm } from '@inquirer/prompts';
import { displayLogo } from './helpers/art';
import createProject from './cmd/newProject';
import listProjects from './cmd/listProjects';
import { exit } from 'process';
import {
  checkConfigExists,
  createConfig,
  loadConfigFromEnv,
  validateEnvFile,
} from './helpers/config';
import chalk from 'chalk';
import { settings } from './cmd/settings';
import { AWSLambdaClient } from './services/serverless/FunctionsClient';
import axios, { AxiosError } from 'axios';

// Shows CLI logo
displayLogo();

// Load environment variables from .env file
const config = await checkConfigExists();
if (config && config.useEnvFile) {
  await loadConfigFromEnv(config.envPath);
} else {
  console.log(
    chalk.whiteBright.bgRed.bold(
      ' !!! No config file found. Please run the setup command \n',
    ),
  );
}

const whatToDo = await select({
  message: 'What do you want to do?',
  choices: [
    { name: 'Create a new project', value: 'new' },
    { name: 'List projects', value: 'ls' },
    { name: 'Deploy a service', value: 'deploy' },
    { name: 'Settings', value: 'settings' },
    { name: 'Function Test', value: 'test' },
    { name: 'Exit', value: 'exit' },
  ],
});

if (whatToDo === 'test') {
  const KEY = process.env.AMZ_ID || '';
  const SEC = process.env.AMZ_SEC || '';
  console.log('KEY:', KEY);
  const client = new AWSLambdaClient('us-east-1', KEY, SEC);

  // Create a simple Lambda function
  const code = `
    exports.handler = async (event) => {
      let responseBody = 'Hello from Lambda!';
      
      if (event.body) {
        const body = JSON.parse(event.body);
        responseBody = \`Hello, \${body.name || 'Anonymous'}! This is a POST request.\`;
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: responseBody,
          method: event.httpMethod,
        }),
      };
    };
    `;

  async function test() {
    const functionName = 'myFunction1234'; // Use a consistent function name
    let apiUrl: string | undefined;

    try {
      // Create or update the function
      console.log('Creating or updating Lambda function...');
      const functionConfig = await client.createOrUpdateFunction(
        functionName,
        code,
      );
      console.log('Function configuration:', functionConfig);

      // Create the API Gateway
      console.log('Creating API Gateway...');
      apiUrl = await client.createApiGateway(functionName);
      console.log('API Gateway URL:', apiUrl);

      // Test GET request
      console.log('Testing GET request...');
      const getResponse = await axios.get(apiUrl);
      console.log('GET response:', getResponse.data);

      // Test POST request
      console.log('Testing POST request...');
      const postResponse = await axios.post(apiUrl, { name: 'John Doe' });
      console.log('POST response:', postResponse.data);

      // Pause for a moment to ensure all AWS operations are complete
      console.log('Pausing before teardown...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Tear down all resources
      console.log('Tearing down resources...');
      await client.tearDown(functionName);

      console.log('Test completed successfully');
    } catch (error) {
      console.error('Error during test:', error);
      if (error) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
    } finally {
      if (apiUrl) {
        console.log('Final API URL for manual testing if needed:', apiUrl);
      }
    }
  }
  await test();

  exit(0);
}

if (whatToDo !== 'settings') {
  if (!config) {
    console.log(
      chalk.whiteBright.bgRed.bold(
        ' !!! No config file found. Please run the setup command \n',
      ),
    );
    exit(1);
  }
}

switch (whatToDo) {
  case 'settings': {
    await settings(config);
    break;
  }
  case 'new':
    console.log('Creating a new project...');
    await createProject();
    break;
  case 'ls':
    console.log('Listing projects...');
    await listProjects();
    break;
  case 'deploy':
    console.log('Deploying a service...');
    break;
  case 'exit':
    console.log('Exiting...');
    exit(0);
    break;
  default:
    console.log('Invalid choice');
    exit(1);
}
