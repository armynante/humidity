declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    EXT_WARN = 4,
    EXT_INFO = 5,
    EXT_DEBUG = 6
}
export declare class Logger {
    private level;
    private serviceName;
    constructor(level?: keyof typeof LogLevel, serviceName?: string);
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    extWarn(message: string, ...args: any[]): void;
    extInfo(message: string, ...args: any[]): void;
    extDebug(message: string, ...args: any[]): void;
    setLevel(level: keyof typeof LogLevel): void;
    private log;
    private getColoredLevel;
}
export {};
