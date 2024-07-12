'use strict'

const { join } = require('path')
const { test, before, sinon } = require('tap')
const { Wait, GenericContainer } = require('testcontainers')
const { extract } = require('tar-stream')
const { text } = require('node:stream/consumers')
const { setInterval } = require('node:timers/promises')
const { getOtlpLogger } = require('../../lib/otlp-logger')

const LOG_FILE_PATH = '/etc/test-logs/otlp-logs.log'

let container

before(async () => {
  container = await new GenericContainer(
    'otel/opentelemetry-collector-contrib:0.103.1'
  )
    .withCopyFilesToContainer([
      {
        source: join(__dirname, '..', '..', 'otel-collector-config.yaml'),
        target: '/etc/otel-collector-config.yaml'
      }
    ])
    .withExposedPorts({
      container: 4317,
      host: 4317
    })
    .withExposedPorts({
      container: 4318,
      host: 4318
    })
    .withCommand(['--config=/etc/otel-collector-config.yaml'])
    .withWaitStrategy(Wait.forLogMessage('Everything is ready'))
    .withCopyContentToContainer([
      {
        content: '',
        target: LOG_FILE_PATH,
        mode: parseInt('0777', 8)
      }
    ])
    .start()
})

test('Log with simple config', async ({ same, hasStrict }) => {
  sinon.stub(console, 'dir')
  const loggerName = 'test-logger-name'
  const resourceAttributes = {
    'service.name': 'test-service',
    'service.version': 'test-service-version'
  }

  const serviceVersion = 'test-service-version'
  const recordProcessorType = 'simple'

  const grpcLogger = getOtlpLogger({
    loggerName,
    resourceAttributes,
    serviceVersion,
    logRecordProcessorOptions: {
      recordProcessorType,
      exporterOptions: {
        protocol: 'grpc'
      }
    }
  })

  const httpLogger = getOtlpLogger({
    loggerName,
    resourceAttributes,
    serviceVersion,
    logRecordProcessorOptions: {
      recordProcessorType,
      exporterOptions: {
        protocol: 'http'
      }
    }
  })

  const protobufLogger = getOtlpLogger({
    loggerName,
    resourceAttributes,
    serviceVersion,
    logRecordProcessorOptions: {
      recordProcessorType,
      exporterOptions: {
        protocol: 'http/protobuf'
      }
    }
  })

  const multiLogger = getOtlpLogger({
    loggerName,
    resourceAttributes,
    serviceVersion,
    logRecordProcessorOptions: [{
      recordProcessorType,
      exporterOptions: {
        protocol: 'grpc'
      }
    }, {
      recordProcessorType,
      exporterOptions: {
        protocol: 'console'
      }
    }]
  })

  const consoleLogger = getOtlpLogger({
    loggerName,
    resourceAttributes,
    serviceVersion,
    logRecordProcessorOptions: {
      recordProcessorType,
      exporterOptions: {
        protocol: 'console'
      }
    }
  })

  const testTraceId = '12345678901234567890123456789012'
  const testSpanId = '1234567890123456'
  const testTraceFlags = '01'

  const extra = {
    foo: 'bar',
    baz: 'qux',
    /* eslint-disable camelcase */
    trace_id: testTraceId,
    span_id: testSpanId,
    trace_flags: testTraceFlags
    /* eslint-enable camelcase */
  }

  const testStart = Date.now()

  grpcLogger.emit({
    severityNumber: 1,
    severityText: 'TRACE',
    body: 'test message',
    attributes: {
      ...extra,
      pid: 123,
      hostname: 'test-hostname'
    },
    timestamp: testStart
  })

  httpLogger.emit({
    severityNumber: 2,
    severityText: 'TRACE',
    body: 'test http',
    timestamp: testStart
  })

  protobufLogger.emit({
    severityNumber: 3,
    severityText: 'TRACE',
    body: 'test protobuf',
    attributes: {},
    timestamp: testStart
  })

  multiLogger.emit({
    severityNumber: 4,
    severityText: 'TRACE',
    body: 'test multi',
    timestamp: testStart
  })

  consoleLogger.emit({
    severityNumber: 5,
    severityText: 'TRACE',
    body: 'test console',
    timestamp: testStart
  })

  const expectedResourceAttributes = [
    {
      key: 'service.name',
      value: {
        stringValue: 'test-service'
      }
    },
    {
      key: 'service.version',
      value: {
        stringValue: 'test-service-version'
      }
    }
  ]

  const scope = {
    name: 'test-logger-name',
    version: 'test-service-version'
  }

  const expectedLines = [
    {
      severityNumber: 1,
      severityText: 'TRACE',
      body: { stringValue: 'test message' },
      traceId: testTraceId,
      spanId: testSpanId,
      attributes: [
        { key: 'foo', value: { stringValue: 'bar' } },
        { key: 'baz', value: { stringValue: 'qux' } }
      ]
    },
    {
      severityNumber: 2,
      severityText: 'TRACE',
      body: { stringValue: 'test http' }
    },
    {
      severityNumber: 3,
      severityText: 'TRACE',
      body: { stringValue: 'test protobuf' }
    },
    {
      severityNumber: 4,
      severityText: 'TRACE',
      body: { stringValue: 'test multi' }
    }
  ]

  const expectedConsoleLines = [
    {
      severityNumber: 4,
      severityText: 'TRACE',
      body: 'test multi'
    },
    {
      severityNumber: 5,
      severityText: 'TRACE',
      body: 'test console'
    }
  ]

  const logs = await container.logs()
  let logRecordReceivedOnCollectorCount = 0

  logs
    .on('data', line => {
      if (line.includes('LogRecord')) {
        logRecordReceivedOnCollectorCount++
      }
    })
    .on('err', line => console.error(line))

  // eslint-disable-next-line
  for await (const _ of setInterval(0)) {
    if (logRecordReceivedOnCollectorCount >= expectedLines.length) {
      break
    }
  }

  const stoppedContainer = await container.stop({ remove: false })

  const tarArchiveStream = await stoppedContainer.copyArchiveFromContainer(
    LOG_FILE_PATH
  )

  const extractedArchiveStream = extract()

  tarArchiveStream.pipe(extractedArchiveStream)

  const archivedFileContents = []

  for await (const entry of extractedArchiveStream) {
    const fileContent = await text(entry)
    archivedFileContents.push(fileContent)
  }

  const content = archivedFileContents.join('\n')

  const lines = content.split('\n').filter(Boolean)
  const consoleLines = console.dir.getCalls().map(call => call.firstArg)

  same(lines.length, expectedLines.length, 'correct number of lines')
  same(consoleLines.length, expectedConsoleLines.length, 'correct number of console lines')

  lines.forEach(line => {
    const foundAttributes = JSON.parse(
      line
    ).resourceLogs?.[0]?.resource.attributes.filter(
      attribute =>
        attribute.key === 'service.name' || attribute.key === 'service.version'
    )
    hasStrict(foundAttributes, expectedResourceAttributes)
  })

  lines.forEach(line => {
    hasStrict(JSON.parse(line).resourceLogs?.[0]?.scopeLogs?.[0]?.scope, scope)
  })

  const logRecords = [...lines.entries()]
    .map(([_lineNumber, logLine]) => {
      return JSON.parse(logLine).resourceLogs?.[0]?.scopeLogs?.[0]
        ?.logRecords?.[0]
    })
    .sort((a, b) => {
      return a.severityNumber - b.severityNumber
    })

  for (let i = 0; i < logRecords.length; i++) {
    const logRecord = logRecords[i]
    const expectedLine = expectedLines[i]
    hasStrict(logRecord, expectedLine, `line ${i} is mapped correctly`)
  }

  const consoleLogRecords = consoleLines
    .sort((a, b) => {
      return a.severityNumber - b.severityNumber
    })

  for (let i = 0; i < consoleLogRecords.length; i++) {
    const logRecord = consoleLogRecords[i]
    const expectedLine = expectedConsoleLines[i]
    hasStrict(logRecord, expectedLine, `console line ${i} is mapped correctly`)
  }

  await Promise.all([
    grpcLogger.shutdown(),
    httpLogger.shutdown(),
    protobufLogger.shutdown(),
    multiLogger.shutdown(),
    consoleLogger.shutdown()
  ])
})
