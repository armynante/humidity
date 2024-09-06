import chalk from 'chalk';
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["EXT_WARN"] = 4] = "EXT_WARN";
    LogLevel[LogLevel["EXT_INFO"] = 5] = "EXT_INFO";
    LogLevel[LogLevel["EXT_DEBUG"] = 6] = "EXT_DEBUG";
})(LogLevel || (LogLevel = {}));
export class Logger {
    level;
    serviceName;
    constructor(level = 'INFO', serviceName) {
        this.level = LogLevel[level];
        this.serviceName = serviceName || '';
    }
    error(message, ...args) {
        this.log(LogLevel.ERROR, message, ...args);
    }
    warn(message, ...args) {
        this.log(LogLevel.WARN, message, ...args);
    }
    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }
    extWarn(message, ...args) {
        this.log(LogLevel.EXT_WARN, message, ...args);
    }
    extInfo(message, ...args) {
        this.log(LogLevel.EXT_INFO, message, ...args);
    }
    extDebug(message, ...args) {
        this.log(LogLevel.EXT_DEBUG, message, ...args);
    }
    setLevel(level) {
        this.level = LogLevel[level];
    }
    log(level, message, ...args) {
        if (level <= this.level) {
            const timestamp = new Date().toISOString();
            const coloredLevel = this.getColoredLevel(level);
            const serviceNamePrefix = this.serviceName
                ? `[${this.serviceName}] `
                : '';
            console.log(`${chalk.gray(`[${timestamp}]`)} ${serviceNamePrefix}${coloredLevel}: ${message}`, ...args);
        }
    }
    getColoredLevel(level) {
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
