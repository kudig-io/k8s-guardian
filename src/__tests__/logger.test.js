const winston = require('winston')

jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}))

describe('Logger', () => {
  it('should create logger instance', () => {
    const logger = require('../src/logger')

    expect(winston.createLogger).toHaveBeenCalled()
    expect(logger).toBeDefined()
  })
})
