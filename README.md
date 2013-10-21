seneca-cassandra
================

seneca-cassandra is a [Cassandra] database plugin for the [Seneca][seneca] MVP toolkit.

Usage:

    var seneca = require('seneca');
    var store = require('seneca-postgres');

    var config = {}
    var storeopts = {
      name:'dbname',
      host:'127.0.0.1',
      port:5432,
      username:'user',
      password:'password'
    };

    ...

    var si = seneca(config)
    si.use(store, storeopts)
    si.ready(function() {
      var product = si.make('product')
      ...
    })
    ...

[seneca]: http://senecajs.org/


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
{column_name : p2,validation_class : UTF8Type}
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
{column_name : mark,validation_class : UTF8Type},
{column_name : seneca,validation_class : UTF8Type}
];