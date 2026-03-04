const dotenv = require('dotenv')
const path = require('path')
const logger = require('./logger')

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const config = {
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo'
  },
  web: {
    port: parseInt(process.env.WEB_UI_PORT) || 8080,
    host: process.env.WEB_UI_HOST || '0.0.0.0'
  },
  kubernetes: {
    kubeconfig: process.env.KUBECONFIG || '~/.kube/config'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT) || 9090
  },
  backup: {
    dir: process.env.BACKUP_DIR || '~/.k8s-guardian/backups'
  },
  alert: {
    email: {
      enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
      smtp: {
        host: process.env.ALERT_EMAIL_SMTP_HOST || 'smtp.example.com',
        port: parseInt(process.env.ALERT_EMAIL_SMTP_PORT) || 587,
        user: process.env.ALERT_EMAIL_USER || '',
        password: process.env.ALERT_EMAIL_PASSWORD || ''
      },
      from: process.env.ALERT_EMAIL_FROM || 'noreply@example.com',
      to: process.env.ALERT_EMAIL_TO || 'admin@example.com'
    }
  },
  security: {
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    }
  },
  performance: {
    cache: {
      enabled: process.env.CACHE_ENABLED === 'true',
      ttl: parseInt(process.env.CACHE_TTL_SECONDS) || 300
    }
  },
  env: process.env.NODE_ENV || 'development',
  debug: process.env.DEBUG === 'true'
}

function validateConfig () {
  const errors = []

  if (config.env === 'production') {
    if (!config.ai.apiKey) {
      logger.warn('AI_API_KEY is not set. AI features will be disabled.')
    }

    if (!config.alert.email.smtp.user && config.alert.email.enabled) {
      errors.push('ALERT_EMAIL_USER is required when email alerts are enabled')
    }

    if (!config.alert.email.smtp.password && config.alert.email.enabled) {
      errors.push('ALERT_EMAIL_PASSWORD is required when email alerts are enabled')
    }
  }

  if (config.web.port < 1 || config.web.port > 65535) {
    errors.push('WEB_UI_PORT must be between 1 and 65535')
  }

  if (config.metrics.port < 1 || config.metrics.port > 65535) {
    errors.push('METRICS_PORT must be between 1 and 65535')
  }

  const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']
  if (!validLogLevels.includes(config.logging.level)) {
    errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`)
  }

  if (errors.length > 0) {
    errors.forEach(error => logger.error(`Configuration error: ${error}`))
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`)
  }

  logger.info('Configuration validated successfully')
  return true
}

function getConfig () {
  return config
}

module.exports = {
  config,
  validateConfig,
  getConfig
}
