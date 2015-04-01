# mongodbx(not ready yet)
A wrapper of Node.js mongoDB driver with document key compression

## examples
####Code:
```
var mongodb = require('mongodbx');

mongodb.mongodbx.initialize({
    'collections': {
        'mongodbxTest': {
            columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
            enableCompact: true,
        }
    }
});

var record = {'name': 99, 'expireTime': 2, 'deleteFlag': 3, 'notConfiguredKey': 4};
var db = new mongodb.Db('test', new mongodb.Server('localhost', 27017));
db.open(function(err, db){
    var collection = db.collection("mongodbxTest");
    collection.insert(record, {w:1}, function(){
        collection.find().toArray(console.log);
    });
});
```

####Will print:
```
[tong@localhost mongodbx]$ node test.js
[tong@localhost mongodbx]$ node test.js
null [{_id: 551b6822c07e9fb46efac201, name: 99, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4}]

```

####Within mongo shell:
```
rs0:PRIMARY> db.mongodbxTest.find()
{"_id": ObjectId("551b6822c07e9fb46efac201"), "n": 99, "e": 2, "d": 3, "notConfiguredKey": 4}
```

## Background

## Test status

## Api spec

## Known issues

## look into the future
