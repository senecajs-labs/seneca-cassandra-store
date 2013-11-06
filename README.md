seneca-cassandra-store
================

seneca-cassandra-store is a [Cassandra][cassandra] database plugin for the [Seneca][seneca] MVP toolkit.

### Usage

```JavaScript
var seneca = require('seneca');
var store = require('cassandra-store');

var config = {}
var storeopts = {
  name: 'senecatest',
  host: '127.0.0.1',
  port: 9160
};

var si = seneca(config)
si.use(store, storeopts)

si.ready(function() {
  var entity = seneca.make$('typename')
  entity.someproperty = "something"
  entity.anotherproperty = 100

  entity.save$( function(err,entity){ ... } )
  entity.load$( {id: ...}, function(err,entity){ ... } )
  entity.list$( {property: ...}, function(err,entity){ ... } )
  entity.remove$( {id: ...}, function(err,entity){ ... } )
})
```

[seneca]: http://senecajs.org/
[cassandra]: http://cassandra.apache.org/

## Install

```sh
npm install seneca
npm install seneca-cassandra-store
```

### Queries

The standard Seneca query format is supported:

   * `entity.list$({field1:value1, field2:value2, ...})` implies pseudo-query `field1==value1 AND field2==value2, ...`
   * `entity.list$({f1:v1,...},{limit$:10})` means only return 10 results
   * due to cassandra restrictions you cannot use sort$, skip$ and fields$. These are not available for this storage.


### Native Driver

As with all seneca stores, you can access the native driver, in this case, the `node-cassandra-native` `collection` object using `entity.native$(function(err,collection){...})`.


Testing
=======
For creating test environments please run following commands using cassandra-cli

    connect localhost/9160;

    create keyspace senecatest;

    use senecatest;

    create column family foo
    with comparator = UTF8Type
      and key_validation_class = UTF8Type
      and column_metadata =
    [
      {column_name : p1,validation_class : UTF8Type},
      {column_name : p2,validation_class : UTF8Type, index_type : 0, index_name : p2_idx}
    ];

    create column family moon_bar
      with comparator = UTF8Type
      and key_validation_class = UTF8Type
      and column_metadata =
    [
      {column_name : str, validation_class : UTF8Type},
      {column_name : int, validation_class : IntegerType},
      {column_name : dec, validation_class : UTF8Type},
      {column_name : bol, validation_class : BooleanType},
      {column_name : wen, validation_class : UTF8Type},
      {column_name : arr, validation_class : UTF8Type},
      {column_name : obj, validation_class : UTF8Type},
      {column_name : mark,validation_class : UTF8Type, index_type : 0, index_name : mark_idx},
      {column_name : seneca,validation_class : UTF8Type}
    ];
