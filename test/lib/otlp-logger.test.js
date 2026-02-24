'use strict'

const { test } = require('tap')
const requireInject = require('require-inject')
const {
  resourceFromAttributes,
  detectResources: realDetectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
  serviceInstanceIdDetector
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
      serviceInstanceIdDetector,
      detectResources: (opts) => {
        captureCallback(opts.detectors)
        return realDetectResources(opts)
      }
    }
  })
}

test('getOtlpLogger - default detectors when OTEL_NODE_RESOURCE_DETECTORS is not set', async ({
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

  equal(capturedDetectors.length, 5)
  equal(capturedDetectors[0], envDetector)
  equal(capturedDetectors[1], hostDetector)
  equal(capturedDetectors[2], osDetector)
  equal(capturedDetectors[3], processDetector)
  equal(capturedDetectors[4], serviceInstanceIdDetector)

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

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS="host, os" trims whitespace', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'host, os'
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

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=host,aws,gcp ignores unknown detectors', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'host,aws,gcp'
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
  equal(capturedDetectors[0], hostDetector)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=aws,gcp results in empty detectors', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'aws,gcp'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 0)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=all activates all detectors', async ({
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

  equal(capturedDetectors.length, 5)
  equal(capturedDetectors[0], envDetector)
  equal(capturedDetectors[1], hostDetector)
  equal(capturedDetectors[2], osDetector)
  equal(capturedDetectors[3], processDetector)
  equal(capturedDetectors[4], serviceInstanceIdDetector)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=process detects only process', async ({
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

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=serviceinstance detects serviceinstance', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'serviceinstance'
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
  equal(capturedDetectors[0], serviceInstanceIdDetector)

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

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 0)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS="" falls back to defaults', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = ''
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 5)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=none,host none overrides all other entries', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'none,host'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 0)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=all,none none wins over all', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = 'all,none'
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 0)

  await logger.shutdown()
})

test('getOtlpLogger - OTEL_NODE_RESOURCE_DETECTORS=" " whitespace-only falls back to defaults', async ({
  before,
  after,
  equal
}) => {
  before(() => {
    process.env.OTEL_NODE_RESOURCE_DETECTORS = '  '
  })

  after(() => {
    delete process.env.OTEL_NODE_RESOURCE_DETECTORS
  })

  let capturedDetectors
  const { getOtlpLogger } = loadOtlpLoggerWithMock((detectors) => {
    capturedDetectors = detectors
  })

  const logger = getOtlpLogger(baseOpts)

  equal(capturedDetectors.length, 5)

  await logger.shutdown()
})
