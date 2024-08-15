import axios from 'axios';
import { AWSLambdaClient } from './AWSLambdaClient/AWSLambdaClient';

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

export async function testFunctions() {
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
      // @ts-ignore
      console.error('Response data:', error.response.data);
      // @ts-ignore
      console.error('Response status:', error.response.status);
      // @ts-ignore
      console.error('Response headers:', error.response.headers);
    }
  } finally {
    if (apiUrl) {
      console.log('Final API URL for manual testing if needed:', apiUrl);
    }
  }
}
