import { Command } from 'commander';
import { BucketClient } from './BucketClient';
import * as dotenv from 'dotenv';
import cliProgress from 'cli-progress';

// Load environment variables
dotenv.config();

const program = new Command();

const { DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY, DO_SPACES_REGION } =
  process.env as {
    DO_SPACES_ACCESS_KEY: string;
    DO_SPACES_SECRET_KEY: string;
    DO_SPACES_REGION: string;
  };

const bucketClient = new BucketClient({
  accessKey: DO_SPACES_ACCESS_KEY,
  secretKey: DO_SPACES_SECRET_KEY,
  region: DO_SPACES_REGION,
});

program
  .command('upload <bucketName> <filePath> <destination>')
  .description('Upload a file to the specified bucket')
  .action(async (bucketName, filePath, destination) => {
    const progressBar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic,
    );

    progressBar.start(100, 0);

    await bucketClient.uploadFile(
      bucketName,
      filePath,
      destination,
      (transferred, total) => {
        const percentage = (transferred / total) * 100;
        progressBar.update(percentage);
      },
    );

    progressBar.stop();
  });

program.parse(process.argv);
