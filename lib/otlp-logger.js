'use strict'

const { LoggerProvider } = require('@opentelemetry/sdk-logs')
const { logs } = require('@opentelemetry/api-logs') // TODO: optional import
const api = require('@opentelemetry/api')
const {
  resourceFromAttributes,
  detectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector
} = require('@opentelemetry/resources')
const { createLogProcessor } = require('./create-log-processor')

/**
 * @typedef {Object} Options
 * @property {string} loggerName
 * @property {string} serviceVersion
 * @property {import('./create-log-processor').LogRecordProcessorOptions | import('./create-log-processor').LogRecordProcessorOptions[]} [logRecordProcessorOptions]
 * @property {Object} [resourceAttributes={}]
 *
 * @param {Options} opts
 */
function getOtlpLogger (opts) {
  const detectedResource = detectResources({
    detectors: [
      envDetector,
      hostDetector,
      osDetector,
      processDetector
    ]
  })

  const logRecordProcessorOptionsArray = Array.isArray(opts.logRecordProcessorOptions) ? opts.logRecordProcessorOptions : [opts.logRecordProcessorOptions]

  const loggerProvider = new LoggerProvider({
    resource: detectedResource.merge(
      resourceFromAttributes({ ...opts.resourceAttributes })
    ),
    processors: logRecordProcessorOptionsArray.map(logRecordProcessorOptions => createLogProcessor(logRecordProcessorOptions))
  })

  logs.setGlobalLoggerProvider(loggerProvider)

  const logger = loggerProvider.getLogger(opts.loggerName, opts.serviceVersion)

  return {
    /**
     * @param {import('@opentelemetry/api-logs').LogRecord} obj
     */
    emit (obj) {
      logger.emit(loadContext(obj))
    },
    async shutdown () {
      return loggerProvider.shutdown()
    }
  }
}

/**
 * load context from attributes and set it to logRecord.context
 *
 * @param {import('@opentelemetry/api-logs').LogRecord} logRecord
 * @returns {import('@opentelemetry/api-logs').LogRecord}
 */
function loadContext (logRecord) {
  let context = api.context.active()
  let attributes = logRecord.attributes

  if (typeof attributes !== 'undefined') {
    /* eslint-disable camelcase */
    const { trace_id, span_id, trace_flags, ...otherAttributes } =
      logRecord.attributes

    if (
      typeof trace_id !== 'undefined' &&
      typeof span_id !== 'undefined' &&
      typeof trace_flags !== 'undefined'
    ) {
      context = api.trace.setSpanContext(context, {
        traceId: trace_id,
        spanId: span_id,
        traceFlags: trace_flags,
        isRemote: true
      })
    }

    attributes = otherAttributes
    /* eslint-enable camelcase */
  }

  return {
    ...logRecord,
    attributes,
    context
  }
}

module.exports = {
  getOtlpLogger
}
