'use strict'

const tap = require('tap')

const { MultiLogRecordProcessor } = require('../../lib/multi-log-processor')

// Write individual test cases
tap.test(
  'calls LogRecordProcessor each method for each of the supplied processors',
  t => {
    const mockProcessor1 = {
      onEmit: () => {},
      shutdown: () => {},
      forceFlush: () => {}
    }

    const mockProcessor2 = Object.assign({}, mockProcessor1)

    const stubEmit1 = t.sinon.stub(mockProcessor1, 'onEmit')
    const stubShutdown1 = t.sinon.stub(mockProcessor1, 'shutdown')
    const stubForceFlush1 = t.sinon.stub(mockProcessor1, 'forceFlush')

    const stubEmit2 = t.sinon.stub(mockProcessor2, 'onEmit')
    const stubShutdown2 = t.sinon.stub(mockProcessor2, 'shutdown')
    const stubForceFlush2 = t.sinon.stub(mockProcessor2, 'forceFlush')

    const processor = new MultiLogRecordProcessor(
      [mockProcessor1, mockProcessor2],
      0
    )

    processor.onEmit()

    t.sinon.assert.calledOnce(stubEmit1)
    t.sinon.assert.calledOnce(stubEmit2)

    processor.shutdown()

    t.sinon.assert.calledOnce(stubShutdown1)
    t.sinon.assert.calledOnce(stubShutdown2)

    processor.forceFlush()

    t.sinon.assert.calledOnce(stubForceFlush1)
    t.sinon.assert.calledOnce(stubForceFlush2)

    t.end()
  }
)
