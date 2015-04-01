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
* Performance: about 250ms to compress/decompress 10k documents(Core i7 3.40GHZ).

## Api spec
####mongodbx.initialize(params)
* params.collections (Object)
  -params.collections[].enableCompact (Boolean, default: params.debug). collection level compress config.
  -params.collections[].columns (Array/Object).
    * Object: translate map;
    * Array: using base62(a-z, A-Z, 0-9) to compress, the compressed value is key's index in columns array. Make sure this array is append only.
* params.enableCompact (Boolean, default:false). Global compress config.
* params.debug (Boolean, default:false).
```
mongodb.mongodbx.initialize({
    'collections': {
        'mongodbxTest': {
            columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
            enableCompact: true,
        },
        'mongodbxTestBase62Map': {
            columns: ['name', 'expireTime', 'deleteFlag'],
            enableCompact: true,
        },
        'noCompactCol': {
            columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
            enableCompact: false,
        },
        'dependOnBlockConfig': {
            columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
        },
    },
    enableCompact: true
});
```

####mongodbx.addCollection(collectionName, params)
* params. see mongodbx.initialize params.collections[]

####mongodbx.getColumnNameMap = function(collectionName);
```
console.log(mongodb.mongodbx.getColumnNameMap('mongodbxTest'));
```
Will print:
```
{ name: 'n', expireTime: 'e', deleteFlag: 'd' }
```

####mongodbx.translateToCompact(inputStr, collectionName)
```
console.log('Map translate normal:', mongodb.mongodbx.translateToCompact('name', 'mongodbxTest'));
console.log('Map translate notConfiguredKey:', mongodb.mongodbx.translateToCompact('notConfiguredKey', 'mongodbxTest'));

console.log('Base62 translate 1st Key:', mongodb.mongodbx.translateToCompact('name', 'mongodbxTestBase62Map'));
console.log('Base62 translate 2nd Key:', mongodb.mongodbx.translateToCompact('expireTime', 'mongodbxTestBase62Map'));
console.log('Base62 translate 3rd Key:', mongodb.mongodbx.translateToCompact('deleteFlag', 'mongodbxTestBase62Map'));
console.log('Base62 translate notConfiguredKey:', mongodb.mongodbx.translateToCompact('notConfiguredKey', 'mongodbxTestBase62Map'));
```
Will print:
```
Map translate normal: n
Map translate notConfiguredKey: notConfiguredKey
Base62 translate 1st Key: a
Base62 translate 2nd Key: b
Base62 translate 3rd Key: c
Base62 translate notConfiguredKey: notConfiguredKey
```

####mongodbx.translateToOriginal(encodeStr, collectionName)
```
console.log('Map translate normal:', mongodb.mongodbx.translateToOriginal('n', 'mongodbxTest'));
console.log('Map translate notConfiguredKey:', mongodb.mongodbx.translateToOriginal('notConfiguredKey', 'mongodbxTest'));

console.log('Base62 translate 1st Key:', mongodb.mongodbx.translateToOriginal('a', 'mongodbxTestBase62Map'));
console.log('Base62 translate 2nd Key:', mongodb.mongodbx.translateToOriginal('b', 'mongodbxTestBase62Map'));
console.log('Base62 translate 3rd Key:', mongodb.mongodbx.translateToOriginal('c', 'mongodbxTestBase62Map'));
console.log('Base62 translate notConfiguredKey:', mongodb.mongodbx.translateToOriginal('notConfiguredKey', 'mongodbxTestBase62Map'));
```
Will print
```
Map translate normal: name
Map translate notConfiguredKey: notConfiguredKey
Base62 translate 1st Key: name
Base62 translate 2nd Key: expireTime
Base62 translate 3rd Key: deleteFlag
Base62 translate notConfiguredKey: notConfiguredKey
```

## Known issues
* mongodb.Collection.aggregate not supported
* mongodb.Collection.mapReduce not supported
* mongodb.Collection.group not supported
* mongodb.Collection.find $where not supported

## Todo
With mongodbx, application can get tranlated record. But if we use mongodb shell, the output is still less-readability. Try to solve this...
