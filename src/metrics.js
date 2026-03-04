const client = require('prom-client')

const register = new client.Registry()

client.collectDefaultMetrics({ register })

const metrics = {
  httpRequestsTotal: new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register]
  }),

  httpRequestDuration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 5],
    registers: [register]
  }),

  k8sApiRequestsTotal: new client.Counter({
    name: 'k8s_api_requests_total',
    help: 'Total number of Kubernetes API requests',
    labelNames: ['operation', 'resource_type', 'namespace'],
    registers: [register]
  }),

  k8sApiRequestDuration: new client.Histogram({
    name: 'k8s_api_request_duration_seconds',
    help: 'Duration of Kubernetes API requests in seconds',
    labelNames: ['operation', 'resource_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register]
  }),

  activeWebSockets: new client.Gauge({
    name: 'active_websockets',
    help: 'Number of active WebSocket connections',
    registers: [register]
  }),

  cacheHits: new client.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    registers: [register]
  }),

  cacheMisses: new client.Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    registers: [register]
  }),

  alertsTriggered: new client.Counter({
    name: 'alerts_triggered_total',
    help: 'Total number of alerts triggered',
    labelNames: ['severity', 'type'],
    registers: [register]
  }),

  backupOperations: new client.Counter({
    name: 'backup_operations_total',
    help: 'Total number of backup operations',
    labelNames: ['operation', 'status'],
    registers: [register]
  })
}

function getRegister () {
  return register
}

function incrementHttpRequest (method, route, statusCode) {
  metrics.httpRequestsTotal.labels(method, route, statusCode).inc()
}

function observeHttpDuration (method, route, statusCode, duration) {
  metrics.httpRequestDuration.labels(method, route, statusCode).observe(duration)
}

function incrementK8sApiRequest (operation, resourceType, namespace) {
  metrics.k8sApiRequestsTotal.labels(operation, resourceType, namespace).inc()
}

function observeK8sApiDuration (operation, resourceType, duration) {
  metrics.k8sApiRequestDuration.labels(operation, resourceType).observe(duration)
}

function setActiveWebSockets (count) {
  metrics.activeWebSockets.set(count)
}

function incrementCacheHits () {
  metrics.cacheHits.inc()
}

function incrementCacheMisses () {
  metrics.cacheMisses.inc()
}

function incrementAlerts (severity, type) {
  metrics.alertsTriggered.labels(severity, type).inc()
}

function incrementBackupOperations (operation, status) {
  metrics.backupOperations.labels(operation, status).inc()
}

module.exports = {
  register,
  metrics,
  getRegister,
  incrementHttpRequest,
  observeHttpDuration,
  incrementK8sApiRequest,
  observeK8sApiDuration,
  setActiveWebSockets,
  incrementCacheHits,
  incrementCacheMisses,
  incrementAlerts,
  incrementBackupOperations
}
