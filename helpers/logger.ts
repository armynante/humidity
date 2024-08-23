import chalk from 'chalk';

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  EXT_WARN = 4,
  EXT_INFO = 5,
  EXT_DEBUG = 6,
}

export class Logger {
  private level: LogLevel;

  constructor(level: keyof typeof LogLevel = 'INFO') {
    this.level = LogLevel[level];
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  extWarn(message: string, ...args: any[]): void {
    this.log(LogLevel.EXT_WARN, message, ...args);
  }

  extInfo(message: string, ...args: any[]): void {
    this.log(LogLevel.EXT_INFO, message, ...args);
  }

  extDebug(message: string, ...args: any[]): void {
    this.log(LogLevel.EXT_DEBUG, message, ...args);
  }

  setLevel(level: keyof typeof LogLevel): void {
    this.level = LogLevel[level];
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const coloredLevel = this.getColoredLevel(level);
      console.log(
        `${chalk.gray(`[${timestamp}]`)} ${coloredLevel}: ${message}`,
        ...args,
      );
    }
  }

  private getColoredLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return chalk.red(LogLevel[level]);
      case LogLevel.WARN:
        return chalk.yellow(LogLevel[level]);
      case LogLevel.INFO:
        return chalk.blue(LogLevel[level]);
      case LogLevel.DEBUG:
        return chalk.green(LogLevel[level]);
      case LogLevel.EXT_WARN:
        return chalk.red.bold(LogLevel[level]);
      case LogLevel.EXT_INFO:
        return chalk.green(LogLevel[level]);
      case LogLevel.EXT_DEBUG:
        return chalk.yellow(LogLevel[level]);
      default:
        return LogLevel[level];
    }
  }
}

// Usage example:
// const logger = new Logger('EXT_DEBUG');
// logger.info('This is an info message');
// logger.debug('This is a debug message');
// logger.warn('This is a warning message');
// logger.error('This is an error message');
// logger.extInfo('This is an extended info message');
// logger.extWarn('This is an extended warning message');
// logger.extDebug('This is an extended debug message');
