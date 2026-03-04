const request = require('supertest')
const express = require('express')

describe('Web Server', () => {
  let app

  beforeEach(() => {
    app = express()
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy' })
    })
    app.get('/ready', (req, res) => {
      res.json({ status: 'ready' })
    })
  })

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'healthy')
    })
  })

  describe('Readiness Check', () => {
    it('should return ready status', async () => {
      const response = await request(app).get('/ready')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ready')
    })
  })
})
