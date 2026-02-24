'use strict'

const { test } = require('tap')
const requireInject = require('require-inject')
const {
  resourceFromAttributes,
  detectResources: realDetectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector
} = require('@opentelemetry/resources')

const baseOpts = {
  loggerName: 'test-logger',
  serviceVersion: '1.0.0',
  resourceAttributes: { 'service.name': 'test-service' },
  logRecordProcessorOptions: {
    recordProcessorType: 'simple',
    exporterOptions: { protocol: 'console' }
  }
}

function loadOtlpLoggerWithMock (captureCallback) {
  return requireInject('../../lib/otlp-logger', {
    '@opentelemetry/resources': {
      resourceFromAttributes,
      envDetector,
      hostDetector,
      osDetector,
      processDetector,
      detectResources: (opts) => {
        captureCallback(opts.detectors)
        return realDetectResources(opts)
      }
    }
  })
}

test('getOtlpLogger - default detectors when env var is not set', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 4)
  equal(capturedDetectors[0], envDetector)
  equal(capturedDetectors[1], hostDetector)
  equal(capturedDetectors[2], osDetector)
  equal(capturedDetectors[3], processDetector)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=none skips detection', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'none'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let detectResourcesCalled = false
  const { getOtlpLogger } = loadOtlpLoggerWithMock(() => {
    detectResourcesCalled = true
  })

  const logger = getOtlpLogger(baseOpts)

  equal(detectResourcesCalled, false)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=all uses all detectors', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'all'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 4)
  equal(capturedDetectors[0], envDetector)
  equal(capturedDetectors[1], hostDetector)
  equal(capturedDetectors[2], osDetector)
  equal(capturedDetectors[3], processDetector)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=process only detects process', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'process'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 1)
  equal(capturedDetectors[0], processDetector)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=host,os detects only host and os', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'host,os'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 2)
  equal(capturedDetectors[0], hostDetector)
  equal(capturedDetectors[1], osDetector)

  await logger.shutdown()
})
