import { select } from '@inquirer/prompts';
import { ModuleDetectionKind } from 'typescript';

const buildTSConfig = async () => {
  const answers = await select({
    message: 'Do you want to enable strict type checking?',
    choices: [
      { name: 'Yes', value: true },
      { name: 'No', value: false },
    ],
  });

  const tsConfig = {
    compilerOptions: {
      outDir: 'dist',
      // Enable latest features
      lib: ['ESNext', 'DOM'],
      target: 'ESNext',
      module: 'ESNext',
      moduleDetection: "force",
      jsx: 'react-jsx',
      allowJs: true,
      
      // Bundler mode
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      verbatimModuleSyntax: true,
      noEmit: true,
      
      // Best practices
      strict: answers,
      skipLibCheck: true,
      noFallthroughCasesInSwitch: true,

      // Stricter flags
      noUnusedLocals: true,
      noUnusedParameters: true,
      noPropertyAccessFromIndexSignature: true,
      forceConsistentCasingInFileNames: true,
      
    },
    include: ['src'],
  };

  return tsConfig;
}