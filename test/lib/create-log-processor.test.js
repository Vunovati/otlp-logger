'use strict'

const { test } = require('tap')

const { createLogProcessor } = require('../../lib/create-log-processor')
const {
  BatchLogRecordProcessor,
  SimpleLogRecordProcessor,
  ConsoleLogRecordExporter
} = require('@opentelemetry/sdk-logs')
const {
  OTLPLogExporter: GrpcExporter
} = require('@opentelemetry/exporter-logs-otlp-grpc')
const {
  OTLPLogExporter: ProtoExporter
} = require('@opentelemetry/exporter-logs-otlp-proto')
const {
  OTLPLogExporter: HttpExporter
} = require('@opentelemetry/exporter-logs-otlp-http')

test('createLogProcessor - no params', async ({ type }) => {
  const logProcessor = createLogProcessor()

  type(logProcessor, BatchLogRecordProcessor)
})

test('createLogProcessor - empty opts', async ({ type }) => {
  const logProcessor = createLogProcessor({})

  type(logProcessor, BatchLogRecordProcessor)
})

test('createLogProcessor - simple', async ({ type }) => {
  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple'
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, ProtoExporter)
})

test('createLogProcessor - simple with console exporter', async ({ type }) => {
  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple',
    exporterOptions: {
      protocol: 'console'
    }
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, ConsoleLogRecordExporter)
})

test('createLogProcessor - simple with grpc exporter', async ({ type }) => {
  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple',
    exporterOptions: {
      protocol: 'grpc'
    }
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, GrpcExporter)
})

test('createLogProcessor - simple with grpc exporter set as env var', async ({
  type,
  before,
  after
}) => {
  before(() => {
    process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL = 'grpc'
  })

  after(() => {
    delete process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL
  })

  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple'
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, GrpcExporter)
})

test('createLogProcessor - simple with http exporter set as env var', async ({
  type,
  before,
  after
}) => {
  before(() => {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http'
  })

  after(() => {
    delete process.env.OTEL_EXPORTER_OTLP_PROTOCOL
  })

  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple'
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, HttpExporter)
})

test('createLogProcessor - simple with http exporter', async ({ type }) => {
  const logProcessor = createLogProcessor({
    recordProcessorType: 'simple',
    exporterOptions: {
      protocol: 'http'
    }
  })

  type(logProcessor, SimpleLogRecordProcessor)
  type(logProcessor._exporter, HttpExporter)
})

test('createLogProcessor - batch with console exporter', async ({
  type
}) => {
  const logProcessor = createLogProcessor({
    recordProcessorType: 'batch',
    exporterOptions: {
      protocol: 'console'
    },
    processorConfig: {
      maxQueueSize: 42
    }
  })

  type(logProcessor, BatchLogRecordProcessor)
  type(logProcessor._exporter, ConsoleLogRecordExporter)
})
