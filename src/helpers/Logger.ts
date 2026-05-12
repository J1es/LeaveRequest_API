import * as winston from "winston";

export class Logger {

    private static instance: winston.Logger = winston.createLogger({
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        ),
        transports: [
            new winston.transports.File({ filename: 'error.log', level: 'error' }),
            new winston.transports.File({
            filename: 'unauthorised_access.log',
            level: 'warn',
            format: winston.format((info) => {
            return info.level === 'warn' ? info : false})()
        }),
            new winston.transports.File({ filename: 'output.log' }),
        ],
    });
    
    static info(message: string, meta?: any) { this.instance.info(message, meta); }
    static error(message: string, meta?: any) { this.instance.error(message, meta); }
    static warn(message: string, meta?: any) { this.instance.warn(message, meta); }
    static debug(message: string, meta?: any) { this.instance.debug(message, meta); }
    static trace(message: string, meta?: any) { this.instance.verbose(message, meta); }
}