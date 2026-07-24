import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
      const details = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
      return `${timestamp} ${level.toUpperCase()} ${stack || message}${details}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      // The GUI parses CLI stdout for panel progress, so diagnostics go to stderr.
      stderrLevels: ['error', 'warn', 'info', 'debug']
    })
  ]
});

export default logger;
