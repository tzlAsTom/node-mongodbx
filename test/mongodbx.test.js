var mongodb = require("../index")
    ,mongodbx = mongodb.mongodbx
    ,should = require('should');


describe("mongodbx encode/decodeBaseX", function(){
    it("encode && decode althorithm test", function(){
        //code map
        [
            [0, 'a'], [1, 'b'], [2, 'c'], [3, 'd'], [61, '9'],
            [62, 'ba'], [63, 'bb'], [3843, '99'], [3844, 'baa'], [3845, 'bab']
        ].forEach(function(elem){
            mongodbx.encodeBaseX(elem[0]).should.equal(elem[1]);
            mongodbx.decodeBaseX(elem[1]).should.equal(elem[0]);
        });
    });

    it("encode && decode althorithm should be changable", function(){
        for(var i = 0; i < 100; i++){
            mongodbx.decodeBaseX(mongodbx.encodeBaseX(i)).should.equal(i);
        }

        ['a', 'b', '9', 'ba', '99', 'baa', 'bbb'].forEach(function(elem){
            mongodbx.encodeBaseX(mongodbx.decodeBaseX(elem)).should.equal(elem);
        });
    });
});

var collections = {
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
};
var config = {
    'collections': collections,
    enableCompact: true
};
describe("mongodbx main", function(){
    beforeEach(function(){
        mongodbx.initialize(config);
    });
    describe("initialize", function(){
        it("_id in columns", function(){
            try{
                mongodbx.initialize({collections:{'failedCol':{columns:["name", '_id'], enableCompact:true}}}).should.throwError('cannot contain _id in params.columns');
            }catch(e){};
        });
        it("no parms", function(){
            try{
                mongodbx.initialize().should.throwError('params must be Object');
            }catch(e){};
        });
        it("enableCompact default false", function(){
            mongodbx.initialize({collections:collections});
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongodbx.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongodbx.getColumnNameMap('dependOnBlockConfig'), {});
        });
        it("enableCompact outer true", function(){
            mongodbx.initialize({collections:collections, enableCompact: true});
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongodbx.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongodbx.getColumnNameMap('dependOnBlockConfig'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
        });
        it("enableCompact outer false", function(){
            mongodbx.initialize({collections:collections, enableCompact: false});
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongodbx.getColumnNameMap('mongodbxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongodbx.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongodbx.getColumnNameMap('dependOnBlockConfig'), {});
        });
        it("addCollection", function(){
            mongodbx.initialize({collections:collections, enableCompact: false});
            mongodbx.addCollection('newCollection', {
                columns: ['name2', 'expireTime2', 'deleteFlag2'],
                enableCompact: true,
            });
            should.deepEqual(mongodbx.getColumnNameMap('newCollection'), { name2: 'a', expireTime2: 'b', deleteFlag2: 'c' });
        });
    });

    describe("translate", function(){
        var orignalRecord = {_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4};
        var compactRecord = {_id: 1, n: 1, e: 2, d: 3, notConfiguredKey: 4};

        var orignalRecordBase62 = {_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4};
        var compactRecordBase62 = {_id: 1, a: 1, b: 2, c: 3, notConfiguredKey: 4};
        it("compress dot notation key", function(){
            mongodbx.initialize({collections:collections, enableCompact: false});

            mongodbx.translateToCompact('name.0', 'mongodbxTest').should.equal('n.0');
            mongodbx.translateToCompact('notConfiguredKey.name', 'mongodbxTest').should.equal('notConfiguredKey.name');
            mongodbx.translateToCompact('name.0', 'mongodbxTestBase62Map').should.equal('a.0');
            mongodbx.translateToCompact('notConfiguredKey.name', 'mongodbxTestBase62Map').should.equal('notConfiguredKey.name');
        });

        it("compress collection", function(){
            mongodbx.initialize(config);
            should.deepEqual(mongodbx.translateRecordToCompact(orignalRecord, 'mongodbxTest'), compactRecord);
            should.deepEqual(mongodbx.translateRecordToOriginal(compactRecord, 'mongodbxTest'), orignalRecord);

            should.deepEqual(mongodbx.translateRecordToCompact(orignalRecordBase62, 'mongodbxTestBase62Map'), compactRecordBase62);
            should.deepEqual(mongodbx.translateRecordToOriginal(compactRecordBase62, 'mongodbxTestBase62Map'), orignalRecordBase62);
        });

        it("no compress collection", function(){
            mongodbx.initialize(config);
            should.deepEqual(mongodbx.translateRecordToCompact(orignalRecord, 'noCompactCol'), orignalRecord);
            should.deepEqual(mongodbx.translateRecordToOriginal(compactRecord, 'noCompactCol'), compactRecord);
        });

        describe("translate query selector", function(){
            it('$or', function(){
                should.deepEqual(mongodbx.translateQuerySelectorToCompact(
                    {$or: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongodbxTest'),
                    {$or: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('$and', function(){
                should.deepEqual(mongodbx.translateQuerySelectorToCompact(
                    {$and: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongodbxTest'),
                    {$and: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('$nor', function(){
                should.deepEqual(mongodbx.translateQuerySelectorToCompact(
                    {$nor: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongodbxTest'),
                    {$nor: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('complex', function(){
                should.deepEqual(mongodbx.translateQuerySelectorToCompact(
                    {$and: [{name:'name'}, {$or:[{deleteFlag:1}, {expireTime:{$gt:123456789}}]}]}, 'mongodbxTest'),
                    {$and: [{n:'name'}, {$or:[{d:1}, {e:{$gt:123456789}}]}]}
                );
            });
        });

        describe("translate update operator", function(){
            it("common", function(){
                ['$inc', '$mul', '$setOnInsert', '$set', '$unset',
                '$min', '$max', '$currentDate', '$addToSet', '$pop',
                '$pullAll', '$pull', '$pushAll', '$push', '$bit'].forEach(function(elem){
                    var orignalRecord = {};
                    orignalRecord[elem] = {name: 1, expireTime: 2};
                    compactRecord = {};
                    compactRecord[elem] = {n: 1, e: 2};

                    should.deepEqual(mongodbx.translateUpdateOperatorToCompact(orignalRecord, 'mongodbxTest'), compactRecord);
                });
            });
            it('$rename', function(){
                should.deepEqual(mongodbx.translateUpdateOperatorToCompact({$rename:{'expireTime': 'deleteFlag'}}, 'mongodbxTest'), {$rename:{e: 'd'}});
            });
        });

        describe("translate sort array", function(){
            it("common", function(){
                should.deepEqual(mongodbx.translateSortArrayToCompact([['name', 1], ['expireTime', -1]], 'mongodbxTest'), [['n', 1], ['e', -1]]);
            });
        });
    });

    describe("performance test", function(){
        it("map", function(){
            var oriRecord = []
            for(var i = 0; i < 100000; i++){
                oriRecord.push({_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4});
            }

            console.time('compress');
            var compactRecord = mongodbx.translateRecordToCompact(oriRecord, 'mongodbxTest');
            console.timeEnd('compress');

            console.time('decompress');
            var deCompactRecord = mongodbx.translateRecordToOriginal(compactRecord, 'mongodbxTest');
            console.timeEnd('decompress');

            should.ok(true);
        });

        it("base62", function(){
            var oriRecord = []
            for(var i = 0; i < 100000; i++){
                oriRecord.push({_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4});
            }

            console.time('compress');
            var compactRecord = mongodbx.translateRecordToCompact(oriRecord, 'mongodbxTestBase62Map');
            console.timeEnd('compress');

            console.time('decompress');
            var deCompactRecord = mongodbx.translateRecordToOriginal(compactRecord, 'mongodbxTestBase62Map');
            console.timeEnd('decompress');

            should.ok(true);
        });
    });

    describe("all mongodb api", function(){
        it("todo", function(){
            var mongodbx = require('../lib/mongodbx');
            mongodbx.initialize(config);

            //should.fail('todo');
/*
git clone https://github.com/mongodb/node-mongodb-native.git
cd node-mongodb-native
npm install
vi test/runner.js LINE 50
    var Configuration = function(context) {
        var mongo = require('../index.js');
=>
    var Configuration = function(context) {
        var mongo = require('../index.js');
        mongo.mongodbx = require('../../mongodbx/lib/mongodbx');

        mongo.mongodbx.initialize({
            'collections': {
                'test_find_simple': {
                    columns: {'a': 'b', b: 'a',  'deleteFlag': 'd'},
                    enableCompact: true,
                }
            },
            //debug: true,
        });

cd ../mongodbx
vi lib/mongodbx.js LINE 3
    var mongodb = require('mongodb');
    //for compatibility test with mongodb driver
    //var mongodb = require('../../node-mongodb-native/index.js');
=>
    var mongodb = require('mongodb');
    //for compatibility test with mongodb driver
    var mongodb = require('../../node-mongodb-native/index.js');

    [tong@localhost node-mongodb-native]$ node test/runner.js -t functional

*/
        });
    });

});
