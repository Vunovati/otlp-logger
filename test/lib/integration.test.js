'use strict'

const { join } = require('path')
const { test, before } = require('node:test')
const assert = require('node:assert')
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

test('Log with simple config', async () => {
  const consoleDirCalls = []
  const originalConsoleDir = console.dir
  console.dir = (...args) => {
    consoleDirCalls.push(args[0])
  }

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
    trace_id: testTraceId,
    span_id: testSpanId,
    trace_flags: testTraceFlags
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
        { key: 'baz', value: { stringValue: 'qux' } },
        { key: 'pid', value: { intValue: '123' } },
        { key: 'hostname', value: { stringValue: 'test-hostname' } }
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

  // eslint-disable-next-line no-unused-vars
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
  const consoleLines = consoleDirCalls

  assert.strictEqual(lines.length, expectedLines.length, 'correct number of lines')
  assert.strictEqual(consoleLines.length, expectedConsoleLines.length, 'correct number of console lines')

  lines.forEach(line => {
    const foundAttributes = JSON.parse(
      line
    ).resourceLogs?.[0]?.resource.attributes.filter(
      attribute =>
        attribute.key === 'service.name' || attribute.key === 'service.version'
    )
    assert.deepStrictEqual(foundAttributes, expectedResourceAttributes)
  })

  lines.forEach(line => {
    assert.deepStrictEqual(JSON.parse(line).resourceLogs?.[0]?.scopeLogs?.[0]?.scope, scope)
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
    // Only check the fields we care about, ignore extra fields like timeUnixNano, observedTimeUnixNano, flags
    assert.strictEqual(logRecord.severityNumber, expectedLine.severityNumber, `line ${i} severityNumber matches`)
    assert.strictEqual(logRecord.severityText, expectedLine.severityText, `line ${i} severityText matches`)
    assert.deepStrictEqual(logRecord.body, expectedLine.body, `line ${i} body matches`)
    if (expectedLine.traceId) {
      assert.strictEqual(logRecord.traceId, expectedLine.traceId, `line ${i} traceId matches`)
    }
    if (expectedLine.spanId) {
      assert.strictEqual(logRecord.spanId, expectedLine.spanId, `line ${i} spanId matches`)
    }
    if (expectedLine.attributes) {
      assert.deepStrictEqual(logRecord.attributes, expectedLine.attributes, `line ${i} attributes match`)
    }
  }

  const consoleLogRecords = consoleLines
    .sort((a, b) => {
      return a.severityNumber - b.severityNumber
    })

  for (let i = 0; i < consoleLogRecords.length; i++) {
    const logRecord = consoleLogRecords[i]
    const expectedLine = expectedConsoleLines[i]
    assert.strictEqual(logRecord.severityNumber, expectedLine.severityNumber, `console line ${i} severityNumber matches`)
    assert.strictEqual(logRecord.severityText, expectedLine.severityText, `console line ${i} severityText matches`)
    assert.strictEqual(logRecord.body, expectedLine.body, `console line ${i} body matches`)
  }

  await Promise.all([
    grpcLogger.shutdown(),
    httpLogger.shutdown(),
    protobufLogger.shutdown(),
    multiLogger.shutdown(),
    consoleLogger.shutdown()
  ])

  console.dir = originalConsoleDir
})
