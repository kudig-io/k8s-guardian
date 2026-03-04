const winston = require('winston')
const path = require('path')

const logLevel = process.env.LOG_LEVEL || 'info'
const logFormat = process.env.LOG_FORMAT || 'json'

const formats = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat()
)

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level}]: ${message}\n${stack}`
    }
    return `${timestamp} [${level}]: ${message}`
  })
)

const jsonFormat = winston.format.combine(
  winston.format.json()
)

const logger = winston.createLogger({
  level: logLevel,
  format: formats,
  defaultMeta: { service: 'k8s-guardian' },
  transports: [
    new winston.transports.Console({
      format: logFormat === 'json' ? jsonFormat : consoleFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: jsonFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: jsonFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/rejections.log')
    })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

module.exports = logger
