/*jslint node: true*/
/*jslint asi: true */
/* Copyright (c) 2013 Mircea Alexandru */
"use strict";

var _ = require('underscore');
var cassandraClient = require('cassandra-client')
var uuid = require('node-uuid');
var columnUtil = require('./column-util')

var name = 'cassandra-store';

var MIN_WAIT = 16
var MAX_WAIT = 5000

module.exports = function (seneca, opts, cb) {

  var desc;

  opts.minwait = opts.minwait || MIN_WAIT
  opts.maxwait = opts.maxwait || MAX_WAIT

  var minwait
  var dbinst = null
  var specifications = null


  function error(args, err, cb) {
    if (err) {
      seneca.log.debug('error: ' + err)
      seneca.fail({code: 'entity/error', store: name}, cb)

      if ('ECONNREFUSED' == err.code || 'notConnected' == err.message || 'Error: no open connections' == err) {
        minwait = opts.minwait
        if (minwait) {
          reconnect(args)
        }
      }

      return true
    }

    return false
  }


  function reconnect(args) {
    seneca.log.debug('attempting db reconnect')

    configure(specifications, function (err) {
      if (err) {
        seneca.log.debug('db reconnect (wait ' + opts.minwait + 'ms) failed: ' + err)
        minwait = Math.min(2 * minwait, opts.maxwait)
        setTimeout(function () {
          reconnect(args)
        }, minwait)
      }
      else {
        minwait = opts.minwait
        seneca.log.debug('reconnect ok')
      }
    })
  }


  function configure(spec, cb) {
    specifications = spec

    var conf = {}
    conf.user     = spec.username
    conf.keyspace = spec.keyspace || spec.name
    conf.port     = spec.port
    conf.host     = spec.host
    conf.pass     = spec.password

    var Connection = cassandraClient.Connection;
    var con = new Connection(conf);
    con.connect(function(err) {
      if (err) {
        // Failed to establish connection.
        throw err;
      }
      dbinst = con
      cb(err)
    })
  }


  var store = {

    name: name,

    close: function (cb) {
      if (dbinst) {
        dbinst.close()
      }
    },


    save: function (args, cb) {
      var ent = args.ent
      var query;
      ent.key = ent.id || uuid()
      delete ent.id

      query = updatestm(ent)
      query.values.push(ent.key)

      console.log('Statement' + JSON.stringify(query))

      dbinst.execute(query.text, query.values, function (err) {
        if (!error(args, err, cb)) {
          ent.load$({id: ent.key}, function(err, data){
            seneca.log(args.tag$, 'update', data)
            cb(null, data)
          })
        }
        else {
          seneca.fail({code: 'update', tag: args.tag$, store: store.name, query: query, error: err}, cb)
        }
      })
    },


    load: function (args, cb) {
      var qent = args.qent
      var q = args.q

      // fix id-key mapping
      q.key = q.id
      delete q.id

      var query = selectstm(qent, q)

      dbinst.execute(query.text, query.values, function (err, res) {
        if (!error(args, err, cb)) {
          var row = prepareRow(res[0])
          var ent = columnUtil.makeent(qent, row)
          seneca.log(args.tag$, 'load', ent)
          cb(null, ent)
        }
        else {
          seneca.fail({code: 'load', tag: args.tag$, store: store.name, query: query, error: err}, cb)
        }
      })
    },


    list: function (args, cb) {
      var qent = args.qent
      var q = args.q

      // fix id-key mapping
      q.key = q.id
      delete q.id

      var list = []

      var query = selectstm(qent, q)

      query = dbinst.execute(query.text, query.values, function (err, res) {
        if (!error(args, err, cb)) {
          res.forEach(function (cRow) {
            var row = prepareRow(cRow)
            var ent = columnUtil.makeent(qent, row)
            list.push(ent)
          })
          seneca.log(args.tag$, 'list', list.length, list[0])
          cb(null, list)
        }
        else {
          seneca.fail({code: 'list', tag: args.tag$, store: store.name, query: query, error: err}, cb)
        }
      })
    },


    remove: function (args, cb) {
      var qent = args.qent
      var q = args.q

      // fix id-key mapping
      q.key = q.id
      delete q.id

      var query
      if (q.all$) {
        query = truncatestm(qent, q)

        dbinst.execute(query.text, query.values, function (err) {
          if (!error(args, err, cb)) {
            seneca.log(args.tag$, 'remove')
            cb(null)
          }
          else {
            seneca.fail({code: 'remove', tag: args.tag$, store: store.name, query: query, error: err}, cb)
          }
        })
      } else {
        var selectQ = selectstm(qent, q)
        dbinst.execute(selectQ.text, selectQ.values, function (err, results) {
          if (err){
            return cb(err)
          }
          results.forEach(function(row){
            query = deletestm(qent, row.key)
            dbinst.execute(query.text, query.values, function (err) {
              if (!error(args, err, cb)) {
                seneca.log(args.tag$, 'remove')
                cb(null)
              }
              else {
                seneca.fail({code: 'remove', tag: args.tag$, store: store.name, query: query, error: err}, cb)
              }
            })
          })
        })
      }
    },


    native: function (args, done) {
      done('not implemented')
    }
  }


  var updatestm = function (ent) {
    var stm = {}

    var table = columnUtil.tablename(ent)
    var entp = columnUtil.makeentp(ent)
    var fields = entp

    var values = []
    var params = []
    var cnt = 0

    for (var field in fields) {
      if (!(_.isUndefined(entp[field]) || _.isNull(entp[field]))) {
        if ('key' != field){
          values.push(field)
          values.push(entp[field])
          params.push('?=?')
        }
      }
    }

    stm.text = "UPDATE " + escapeStr(table) + " SET " + escapeStr(params) + " WHERE KEY=?"
    stm.values = values

    return stm
  }


  var deletestm = function (qent, key) {
    var stm = {}

    var table = columnUtil.tablename(qent)

    stm.text = "DELETE FROM " + escapeStr(table) + ' WHERE key=?'
    stm.values = [key]

    return stm
  }


  var truncatestm = function (qent, q) {
    var stm = {}

    var table = columnUtil.tablename(qent)

    stm.text = "TRUNCATE " + escapeStr(table)
    stm.values = []

    return stm
  }


  var selectstm = function (qent, q) {
    var stm = {}

    var table = columnUtil.tablename(qent)
    var entp = columnUtil.makeentp(qent)

    var values = []
    var params = []

    var cnt = 0

    var w = whereargs(entp, q)

    var wherestr = ''

    if (!_.isEmpty(w) && w.params.length > 0) {
      w.params.forEach(function (param) {
        params.push(param + '=?')
      })

      w.values.forEach(function (value) {
        values.push(value)
      })

      wherestr = " WHERE " + params.join(' AND ')
    }

    var mq = metaquery(qent, q)

    var metastr = ' ' + mq.params.join(' ')

    stm.text = "SELECT * FROM " + escapeStr(table) + escapeStr(wherestr) + escapeStr(metastr)
    stm.values = values

    return stm
  }


  var whereargs = function (entp, q) {
    var w = {}

    w.params = []
    w.values = []

    var qok = columnUtil.fixquery(entp, q)

    for (var p in qok) {
      if (qok[p]) {
        w.params.push(p)
        w.values.push(qok[p])
      }
    }

    return w
  }

  var prepareRow = function(data){
    var row = {}

    row.id = data.key
    for (var i = 0; i < data.cols.length; i++){
      if (data.cols[i].value instanceof Buffer){
        console.log('is buffer')
        console.log(data.cols[i].value.toString('hex'))
        console.log(data.cols[i].value.toString())
        console.log(data.cols[i].value.readFloatLE(0))
        console.log(data.cols[i].value.readFloatBE(0))
        row[data.cols[i].name] = data.cols[i].value.toString('hex')
      } else{
        row[data.cols[i].name] = data.cols[i].value
      }
    }

    return row
  }


  var metaquery = function (qent, q) {
    var mq = {}

    mq.params = []
    mq.values = []

    if (q.sort$) {
      for (var sf in q.sort$) break;
      var sd = q.sort$[sf] < 0 ? 'ASC' : 'DESC'
      mq.params.push('ORDER BY ' + sf + ' ' + sd)
    }

    if (q.limit$) {
      mq.params.push('LIMIT ' + q.limit$)
    }

    return mq
  }


  seneca.store.init(seneca, opts, store, function (err, tag, description) {
    if (err) return cb(err);

    desc = description

    configure(opts, function (err) {
      if (err) {
        return seneca.fail({code: 'entity/configure', store: store.name, error: err}, cb)
      }
      else cb(null, {name: store.name, tag: tag});
    })
  })

}


var escapeStr = function(input) {
  var str = "" + input;
  return str.replace(/[\0\b\t\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
    switch (char) {
      case "\0":
        return "\\0";
      case "\x08":
        return "\\b";
      case "\b": 
        return "\\b";
      case "\x09":
        return "\\t";
      case "\t": 
        return "\\t";
      case "\x1a":
        return "\\z";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\"":
      case "'":
      case "\\":
      case "%":
        return "\\"+char; 

    }
  });
};

