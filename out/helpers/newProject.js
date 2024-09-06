import fs, { mkdir } from 'node:fs/promises';
export const copyTsStarterFiles = async (p) => {
    const docker = await fs.readFile(new URL('../templates/sampleTSProject/Dockerfile', import.meta.url));
    const ignore = await fs.readFile(new URL('../templates/sampleTSProject/.gitignore', import.meta.url));
    const tsconfig = await fs.readFile(new URL('../templates/sampleTSProject/tsconfig.json', import.meta.url));
    const editorconfig = await fs.readFile(new URL('../templates/sampleTSProject/.editorconfig', import.meta.url));
    const nodemon = await fs.readFile(new URL('../templates/sampleTSProject/nodemon.json', import.meta.url));
    const packageJson = await fs.readFile(new URL('../templates/sampleTSProject/package.json', import.meta.url));
    const packageLock = await fs.readFile(new URL('../templates/sampleTSProject/pnpm-lock.yaml', import.meta.url));
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
    const srcFile = await fs.readFile(new URL('../templates/sampleTSProject/src/index.ts', import.meta.url));
    await fs.writeFile(`${p.projectPath}/src/index.ts`, srcFile);
};
export const copyPrettierFiles = async (p) => {
    const prettier = await fs.readFile(new URL('../templates/sampleTSProject/.prettierrc', import.meta.url));
    const prettierIgnore = await fs.readFile(new URL('../templates/sampleTSProject/.prettierignore', import.meta.url));
    await fs.writeFile(`${p.projectPath}/.prettierrc`, prettier);
    await fs.writeFile(`${p.projectPath}/.prettierignore`, prettierIgnore);
};
export const copyEsLintFiles = async (p) => {
    const eslint = await fs.readFile(new URL('../templates/sampleTSProject/eslint.config.js', import.meta.url));
    const eslintignore = await fs.readFile(new URL('../templates/sampleTSProject/.eslintignore', import.meta.url));
    await fs.writeFile(`${p.projectPath}/.eslint.config.js`, eslint);
    await fs.writeFile(`${p.projectPath}/.eslintignore`, eslintignore);
};
