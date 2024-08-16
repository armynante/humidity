import fs, { mkdir } from 'node:fs/promises';
import type { NewProjectQuestions } from '../types/config';

export const copyTsStarterFiles = async (p: NewProjectQuestions) => {
  const docker = await fs.readFile(
    './templates/skeletons/sampleTSProject/Dockerfile',
  );
  const ignore = await fs.readFile(
    './templates/skeletons/sampleTSProject/.gitignore',
  );
  const tsconfig = await fs.readFile(
    './templates/skeletons/sampleTSProject/tsconfig.json',
  );
  const editorconfig = await fs.readFile(
    './templates/skeletons/sampleTSProject/.editorconfig',
  );
  const nodemon = await fs.readFile(
    './templates/skeletons/sampleTSProject/nodemon.json',
  );
  const packageJson = await fs.readFile(
    './templates/skeletons/sampleTSProject/package.json',
  );
  const packageLock = await fs.readFile(
    './templates/skeletons/sampleTSProject/pnpm-lock.yaml',
  );

  await fs.writeFile(`${p.projectPath}/Dockerfile`, docker);
  await fs.writeFile(`${p.projectPath}/.gitignore`, ignore);
  await fs.writeFile(`${p.projectPath}/tsconfig.json`, tsconfig);
  await fs.writeFile(`${p.projectPath}/.editorconfig`, editorconfig);
  await fs.writeFile(`${p.projectPath}/nodemon.json`, nodemon);
  await fs.writeFile(`${p.projectPath}/package.json`, packageJson);
  await fs.writeFile(`${p.projectPath}/pnpm-lock.yaml`, packageLock);

  // Make the src directory
  await mkdir(`${p.projectPath}/src`);
  // Copy the sample src files
  const srcFile = await fs.readFile(
    './templates/skeletons/sampleTSProject/src/index.ts',
  );
  await fs.writeFile(`${p.projectPath}/src/index.ts`, srcFile);
};

export const copyPrettierFiles = async (p: NewProjectQuestions) => {
  const prettier = await fs.readFile(
    './templates/skeletons/sampleTSProject/.prettierrc',
  );
  const prettierIgnore = await fs.readFile(
    './templates/skeletons/sampleTSProject/.prettierignore',
  );

  await fs.writeFile(`${p.projectPath}/.prettierrc`, prettier);
  await fs.writeFile(`${p.projectPath}/.prettierignore`, prettierIgnore);
};

export const copyEsLintFiles = async (p: NewProjectQuestions) => {
  const eslint = await fs.readFile(
    './templates/skeletons/sampleTSProject/eslint.config.js',
  );
  const eslintignore = await fs.readFile(
    './templates/skeletons/sampleTSProject/.eslintignore',
  );
  await fs.writeFile(`${p.projectPath}/.eslint.config.js`, eslint);
  await fs.writeFile(`${p.projectPath}/.eslintignore`, eslintignore);
};
