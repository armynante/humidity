import { confirm } from '@inquirer/prompts';
import { createDoAppSpec } from '../helpers/digitalOcean';
import { unlink } from 'node:fs/promises';
import Bun from 'bun';

// Create a DO App deploy spec
export const buildDoSpec = async (appName: string) => {
  const confirmName = confirm({
    message: `Do you want to name this app ${appName}?`,
  });
  if (!confirmName) {
    return;
  }

  // check if the spec already exists
  const specFile = Bun.file(`${appName}.spec.yaml`);
  const exists = await specFile.exists();
  if (exists) {
    // delete the file
    const rewrite = await confirm({
      message: 'The spec already exists. Do you want to overwrite it?',
    });
    if (!rewrite) {
      console.log('Not overwriting spec');
      return;
    } else {
      await unlink(`${appName}.spec.yaml`);
    }
  }
  console.log('Creating DO App spec...');
  // create the spec
  const spec = createDoAppSpec(appName, 3000, 'latest', appName);
  return spec;
};
