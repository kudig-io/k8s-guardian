const { connectK8s } = require('./k8s');

// 获取Pod日志
async function getPodLogs(k8sClient, podName, namespace = 'default', options = {}) {
  try {
    const { container, tailLines, follow, sinceSeconds } = options;
    
    const params = {
      name: podName,
      namespace,
      follow: follow || false,
      tailLines: tailLines || 100
    };

    if (container) {
      params.container = container;
    }

    if (sinceSeconds) {
      params.sinceSeconds = sinceSeconds;
    }

    const response = await k8sClient.core.readNamespacedPodLog(podName, namespace, params);
    return response.body;
  } catch (error) {
    throw new Error(`Failed to get pod logs: ${error.message}`);
  }
}

// 分析Pod日志（增强版）
function analyzePodLogs(logs) {
  try {
    const lines = logs.split('\n');
    const analysis = {
      totalLines: lines.length,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      errors: [],
      warnings: [],
      patternAnalysis: {},
      stackTraces: [],
      performanceMetrics: {
        slowRequests: [],
        responseTimeStats: null
      },
      databaseQueries: [],
      apiCalls: [],
      securityEvents: [],
      keywordStats: {},
      timeDistribution: {},
      logLevels: {
        error: 0,
        warning: 0,
        info: 0,
        debug: 0,
        trace: 0,
        fatal: 0
      }
    };

    const errorKeywords = ['error', 'exception', 'fail', 'fatal', 'panic', 'crash'];
    const warningKeywords = ['warning', 'warn', 'deprecated', 'slow'];
    const infoKeywords = ['info', 'information', 'started', 'stopped', 'completed'];
    const debugKeywords = ['debug', 'trace', 'verbose'];
    const securityKeywords = ['unauthorized', 'forbidden', 'authentication failed', 'permission denied', 'security', 'xss', 'sql injection', 'csrf'];
    
    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      
      // 日志级别分析
      if (lowerLine.includes('error') || lowerLine.includes('err')) {
        analysis.logLevels.error++;
        analysis.errorCount++;
        analysis.errors.push({ line: index + 1, content: line });
      } else if (lowerLine.includes('fatal')) {
        analysis.logLevels.fatal++;
        analysis.errorCount++;
        analysis.errors.push({ line: index + 1, content: line });
      } else if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
        analysis.logLevels.warning++;
        analysis.warningCount++;
        analysis.warnings.push({ line: index + 1, content: line });
      } else if (lowerLine.includes('info')) {
        analysis.logLevels.info++;
        analysis.infoCount++;
      } else if (lowerLine.includes('debug')) {
        analysis.logLevels.debug++;
        analysis.debugCount++;
      } else if (lowerLine.includes('trace')) {
        analysis.logLevels.trace++;
      }

      // 堆栈跟踪检测
      if (lowerLine.includes('stack trace') || lowerLine.includes('at ') && lowerLine.includes('(')) {
        analysis.stackTraces.push({ line: index + 1, content: line });
      }

      // 性能指标分析
      const durationMatch = line.match(/(?:duration|elapsed|time|took|spent)[:\s]+(\d+(?:\.\d+)?)\s*(ms|milliseconds|s|seconds)/i);
      if (durationMatch) {
        const duration = parseFloat(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const durationMs = unit.startsWith('s') ? duration * 1000 : duration;
        
        if (durationMs > 1000) {
          analysis.performanceMetrics.slowRequests.push({
            line: index + 1,
            content: line,
            duration: durationMs
          });
        }
      }

      // 数据库查询分析
      const dbQueryMatch = line.match(/(?:select|insert|update|delete|create|drop|alter)\s+(?:from|into|table|index)/i);
      if (dbQueryMatch) {
        analysis.databaseQueries.push({
          line: index + 1,
          content: line,
          type: dbQueryMatch[1].toUpperCase()
        });
      }

      // API 调用分析
      const apiCallMatch = line.match(/(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+https?:\/\/[^\s]+/i);
      if (apiCallMatch) {
        const httpStatusMatch = line.match(/\b(\d{3})\b/);
        analysis.apiCalls.push({
          line: index + 1,
          content: line,
          method: apiCallMatch[1].toUpperCase(),
          status: httpStatusMatch ? httpStatusMatch[1] : null
        });
      }

      // 安全事件检测
      securityKeywords.forEach(keyword => {
        if (lowerLine.includes(keyword)) {
          analysis.securityEvents.push({
            line: index + 1,
            content: line,
            type: keyword
          });
        }
      });

      // 关键词统计
      const keywords = ['timeout', 'retry', 'connection', 'database', 'cache', 'api', 'http', 'https', 'ssl', 'tls', 'memory', 'cpu', 'disk', 'network'];
      keywords.forEach(keyword => {
        if (lowerLine.includes(keyword)) {
          analysis.keywordStats[keyword] = (analysis.keywordStats[keyword] || 0) + 1;
        }
      });

      // 时间戳分析
      const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/);
      if (timestampMatch) {
        analysis.patternAnalysis.timestamp = (analysis.patternAnalysis.timestamp || 0) + 1;
        
        const hourMatch = line.match(/\d{4}-\d{2}-\d{2}[T ](\d{2}):\d{2}:\d{2}/);
        if (hourMatch) {
          const hour = parseInt(hourMatch[1]);
          const timeSlot = `${hour}:00-${hour}:59`;
          analysis.timeDistribution[timeSlot] = (analysis.timeDistribution[timeSlot] || 0) + 1;
        }
      }

      // HTTP 状态码分析
      const httpStatusMatch = line.match(/HTTP\/\d+\.\d+\s+(\d{3})/);
      if (httpStatusMatch) {
        const statusCode = httpStatusMatch[1];
        analysis.patternAnalysis[`http_${statusCode}`] = (analysis.patternAnalysis[`http_${statusCode}`] || 0) + 1;
      }

      // IP 地址分析
      const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      if (ipMatch) {
        analysis.patternAnalysis.ip_addresses = (analysis.patternAnalysis.ip_addresses || 0) + 1;
      }

      // URL 分析
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        analysis.patternAnalysis.urls = (analysis.patternAnalysis.urls || 0) + 1;
      }
    });

    // 计算性能统计
    if (analysis.performanceMetrics.slowRequests.length > 0) {
      const durations = analysis.performanceMetrics.slowRequests.map(r => r.duration);
      analysis.performanceMetrics.responseTimeStats = {
        count: durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length
      };
    }

    // 生成建议
    analysis.recommendations = generateLogRecommendations(analysis);

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze pod logs: ${error.message}`);
  }
}

// 生成日志分析建议
function generateLogRecommendations(analysis) {
  const recommendations = [];

  if (analysis.errorCount > 10) {
    recommendations.push({
      severity: 'high',
      message: `发现 ${analysis.errorCount} 个错误，建议立即检查应用程序日志和错误处理机制`
    });
  }

  if (analysis.warningCount > 20) {
    recommendations.push({
      severity: 'medium',
      message: `发现 ${analysis.warningCount} 个警告，建议优化代码以减少警告信息`
    });
  }

  if (analysis.stackTraces.length > 0) {
    recommendations.push({
      severity: 'high',
      message: `发现 ${analysis.stackTraces.length} 个堆栈跟踪，建议检查异常处理和错误日志`
    });
  }

  if (analysis.performanceMetrics.slowRequests.length > 5) {
    recommendations.push({
      severity: 'medium',
      message: `发现 ${analysis.performanceMetrics.slowRequests.length} 个慢请求（>1秒），建议优化性能`
    });
  }

  if (analysis.securityEvents.length > 0) {
    recommendations.push({
      severity: 'high',
      message: `发现 ${analysis.securityEvents.length} 个安全相关事件，建议立即审查安全配置`
    });
  }

  if (analysis.keywordStats.timeout > 5) {
    recommendations.push({
      severity: 'medium',
      message: `发现多次超时，建议检查网络连接和超时配置`
    });
  }

  if (analysis.keywordStats.retry > 5) {
    recommendations.push({
      severity: 'medium',
      message: `发现多次重试，建议检查依赖服务的可用性`
    });
  }

  if (analysis.keywordStats.memory > 10) {
    recommendations.push({
      severity: 'medium',
      message: `发现多次内存相关日志，建议检查内存使用情况和内存泄漏`
    });
  }

  return recommendations;
}

// 实时跟踪Pod日志
async function streamPodLogs(k8sClient, podName, namespace = 'default', options = {}) {
  try {
    const { container, tailLines } = options;
    
    const params = {
      name: podName,
      namespace,
      follow: true,
      tailLines: tailLines || 10
    };

    if (container) {
      params.container = container;
    }

    const stream = await k8sClient.core.readNamespacedPodLog(podName, namespace, params);
    return stream;
  } catch (error) {
    throw new Error(`Failed to stream pod logs: ${error.message}`);
  }
}

// 搜索日志
function searchLogs(logs, searchTerm, options = {}) {
  try {
    const { caseSensitive = false, regex = false } = options;
    const lines = logs.split('\n');
    const results = [];

    lines.forEach((line, index) => {
      let match = false;
      
      if (regex) {
        const regexPattern = caseSensitive ? new RegExp(searchTerm) : new RegExp(searchTerm, 'i');
        match = regexPattern.test(line);
      } else {
        match = caseSensitive ? line.includes(searchTerm) : line.toLowerCase().includes(searchTerm.toLowerCase());
      }

      if (match) {
        results.push({
          line: index + 1,
          content: line
        });
      }
    });

    return {
      searchTerm,
      totalMatches: results.length,
      matches: results
    };
  } catch (error) {
    throw new Error(`Failed to search logs: ${error.message}`);
  }
}

// 过滤日志
function filterLogs(logs, filters = {}) {
  try {
    const { startTime, endTime, level, keyword } = filters;
    const lines = logs.split('\n');
    const results = [];

    lines.forEach((line, index) => {
      let include = true;

      if (keyword && !line.toLowerCase().includes(keyword.toLowerCase())) {
        include = false;
      }

      if (level) {
        const lowerLine = line.toLowerCase();
        switch (level.toLowerCase()) {
          case 'error':
            if (!lowerLine.includes('error') && !lowerLine.includes('fatal')) {
              include = false;
            }
            break;
          case 'warning':
            if (!lowerLine.includes('warning') && !lowerLine.includes('warn')) {
              include = false;
            }
            break;
          case 'info':
            if (!lowerLine.includes('info')) {
              include = false;
            }
            break;
          case 'debug':
            if (!lowerLine.includes('debug')) {
              include = false;
            }
            break;
        }
      }

      if (include) {
        results.push({
          line: index + 1,
          content: line
        });
      }
    });

    return {
      filters,
      totalMatches: results.length,
      matches: results
    };
  } catch (error) {
    throw new Error(`Failed to filter logs: ${error.message}`);
  }
}

// 获取日志统计
function getLogStats(logs) {
  try {
    const lines = logs.split('\n');
    const stats = {
      totalLines: lines.length,
      emptyLines: 0,
      nonEmptyLines: 0,
      averageLineLength: 0,
      maxLineLength: 0,
      minLineLength: Infinity,
      uniqueLines: new Set(),
      logLevels: {
        error: 0,
        warning: 0,
        info: 0,
        debug: 0,
        trace: 0,
        fatal: 0
      }
    };

    let totalLength = 0;

    lines.forEach(line => {
      if (line.trim() === '') {
        stats.emptyLines++;
      } else {
        stats.nonEmptyLines++;
        const length = line.length;
        totalLength += length;
        stats.maxLineLength = Math.max(stats.maxLineLength, length);
        stats.minLineLength = Math.min(stats.minLineLength, length);
        stats.uniqueLines.add(line);

        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('error')) stats.logLevels.error++;
        else if (lowerLine.includes('fatal')) stats.logLevels.fatal++;
        else if (lowerLine.includes('warning') || lowerLine.includes('warn')) stats.logLevels.warning++;
        else if (lowerLine.includes('info')) stats.logLevels.info++;
        else if (lowerLine.includes('debug')) stats.logLevels.debug++;
        else if (lowerLine.includes('trace')) stats.logLevels.trace++;
      }
    });

    stats.averageLineLength = stats.nonEmptyLines > 0 ? totalLength / stats.nonEmptyLines : 0;
    stats.uniqueLines = stats.uniqueLines.size;
    if (stats.minLineLength === Infinity) stats.minLineLength = 0;

    return stats;
  } catch (error) {
    throw new Error(`Failed to get log stats: ${error.message}`);
  }
}

module.exports = {
  getPodLogs,
  analyzePodLogs,
  streamPodLogs,
  searchLogs,
  filterLogs,
  getLogStats
};