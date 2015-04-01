# mongodbx(not ready yet)
A wrapper of Node.js mongoDB driver with document key compression

## examples
####Code:
```
mongodb.mongodbx.initialize({
    'collections': {
        'mongodbxTest': {
            columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
            enableCompact: true,
        }
    }
});

var record = {'name': 'name', 'expireTime': new Date(), 'deleteFlag': true, 'notConfiguredKey': 'ext'};
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
null [{_id: 551b6c63ee8ff65407e59847, name: 'name', expireTime: Wed Apr 01 2015 11:56:19 GMT+0800 (SGT), deleteFlag: true, notConfiguredKey: 'ext'}]

```
####Within mongo shell:
```
rs0:PRIMARY> db.mongodbxTest.find()
{"_id": ObjectId("551b6c63ee8ff65407e59847"), "n": "name", "e": ISODate("2015-04-01T03:56:19.625Z"), "d": true, "notConfiguredKey": "ext"}
```

## Background
As a key-value database, one fault of mongodb is to saving the key string for each document. This will cost a lot of IO resources. For example, a collection with column named 'deleteFlag', mongodb need extra 11 bytes for key string storage comparing relational database.--The value itself('true'/'false') only need 1 byte!

There do have a 'best pratice' for this: shorten the key string. For 'deleteFlag', design/code with 'fdel', even 'd'. However, this solution will cause some software nightmare. The code's maintainability && readability will be compromised.

To optimise mongodb's storage && be friendly to code/design, we can put a middleware between our application and mongodb driver. The middleware will translate document bi-direction. For example, {deleteFlag: true}(application model) <=> {d: true}(mongodb document).

## Test status
* Pass all test cases in [mongodb driver](https://github.com/mongodb/node-mongodb-native.git)(driver version: 2.0.25, server version: 3.0.1).
* Performance: cost about 250ms to compress/decompress 10k documents.

## Api spec

## Known issues

## look into the future
