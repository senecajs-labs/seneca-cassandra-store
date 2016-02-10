/*global describe:true, it:true*/
'use strict'

var assert = require('chai').assert
var Seneca = require('seneca')
var Async = require('async')
var Eyes = require('eyes')

var shared = Seneca.test.store.shared

var verify = exports.verify = function (cb, tests) {
  return function (error, out) {
    if (error) return cb(error)
    tests(out)
    cb()
  }
}

var si = Seneca({log: 'print'})
si.use(require('..'), {
  name: 'senecatest',
  host: '127.0.0.1',
  port: 9160
})

si.__testcount = 0
var testcount = 0


describe('cassandra', function () {
  it('basic', function (done) {
    testcount++
    shared.basictest(si, done)
  })

  it('specific tests', function (done) {
    testcount++
    specifictest(si, done)
  })

  it('close', function (done) {
    shared.closetest(si, testcount, done)
  })
})


var specifictest = function (si, done) {
  si.ready(function () {
    console.log('SPECIFIC TESTS STARTING')
    assert.isNotNull(si)

    /* Set up a data set for testing the store.
     * //foo contains [{p1:'v1',p2:'v2'},{p2:'v2'}]
     * zen/moon/bar contains [{..bartemplate..}]
     */
    Async.series(
      {
        removeAll: function (cb) {
          console.log('specifictest - removeAll')

          var foo = si.make({name$: 'foo'})

          foo.remove$({all$: true}, function (err, res) {
            assert.isNull(err)

            foo.list$({}, verify(cb, function (res) {
              assert.equal(0, res.length)
            }))
          })
        },
        add1Record: function (cb) {
          console.log('specifictest - save1record')

          var foo1 = si.make({name$: 'foo'})
          foo1.p2 = 'v1'

          foo1.save$(verify(cb, function (foo1) {
            assert.isNotNull(foo1.id)
            assert.equal('v1', foo1.p2)
          }))
        },
        add2Record: function (cb) {
          console.log('specifictest - save2record')

          var foo1 = si.make({name$: 'foo'})
          foo1.p2 = 'v1'

          foo1.save$(verify(cb, function (foo1) {
            assert.isNotNull(foo1.id)
            assert.equal('v1', foo1.p2)
          }))
        },
        add3Record: function (cb) {
          console.log('specifictest - save3record')

          var foo1 = si.make({name$: 'foo'})
          foo1.p2 = 'v1'

          foo1.save$(verify(cb, function (foo1) {
            assert.isNotNull(foo1.id)
            assert.equal('v1', foo1.p2)
          }))
        },
        add4Record: function (cb) {
          console.log('specifictest - save4record')

          var foo1 = si.make({name$: 'foo'})
          foo1.p2 = 'v2'

          foo1.save$(verify(cb, function (foo1) {
            assert.isNotNull(foo1.id)
            assert.equal('v2', foo1.p2)
          }))
        },
        query1_all: function (cb) {
          console.log('specifictest - query1_all')

          var foo = si.make({name$: 'foo'})

          foo.list$({p2: 'v1'}, verify(cb, function (res) {
            assert.ok(3 === res.length)
          }))
        },
        query2_limit2: function (cb) {
          console.log('specifictest - query2_limit2')

          var foo = si.make({name$: 'foo'})

          foo.list$({p2: 'v1', limit$: 2}, verify(cb, function (res) {
            assert.ok(2 === res.length)
          }))
        },
        clean: function (cb) {
          console.log('specifictest - clean')

          var foo = si.make({name$: 'foo'})

          foo.remove$({all$: true}, function (err, res) {
            assert.isNull(err)

            foo.list$({}, verify(cb, function (res) {
              assert.equal(0, res.length)
            }))
          })
        }


      },
      function (err, out) {
        if (err) {
          Eyes.inspect(err)
        }
        si.__testcount++
        assert.isNull(err)
        done && done()
      })
  })
}

