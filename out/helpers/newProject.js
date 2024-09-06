import fs, { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';
export const copyTsStarterFiles = async (p, files) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    for (const file of files) {
        const sourcePath = path.join(__dirname, '..', 'templates', 'sampleTSProject', file);
        const destinationPath = path.join(p.projectPath, file);
        // Create the directory if it doesn't exist
        const destinationDir = path.dirname(destinationPath);
        await fs.mkdir(destinationDir, { recursive: true });
        await fs.copyFile(sourcePath, destinationPath);
    }
};
// export const copyPrettierFiles = async (p: NewProjectQuestions) => {
//   const prettier = await fs.readFile(
//     new URL('../templates/sampleTSProject/.prettierrc', import.meta.url),
//   );
//   const prettierIgnore = await fs.readFile(
//     new URL('../templates/sampleTSProject/.prettierignore', import.meta.url),
//   );
//   await fs.writeFile(`${p.projectPath}/.prettierrc`, prettier);
//   await fs.writeFile(`${p.projectPath}/.prettierignore`, prettierIgnore);
// };
// export const copyEsLintFiles = async (p: NewProjectQuestions) => {
//   const eslint = await fs.readFile(
//     new URL('../templates/sampleTSProject/eslint.config.js', import.meta.url),
//   );
//   const eslintignore = await fs.readFile(
//     new URL('../templates/sampleTSProject/.eslintignore', import.meta.url),
//   );
//   await fs.writeFile(`${p.projectPath}/.eslint.config.js`, eslint);
//   await fs.writeFile(`${p.projectPath}/.eslintignore`, eslintignore);
// };
