var mongodb = require("../index")
    ,mongox = mongodb.mongox
    ,should = require('should');


describe("mongox encode/decodeBaseX", function(){
    it("encode && decode althorithm test", function(){
        //code map
        [
            [0, 'a'], [1, 'b'], [2, 'c'], [3, 'd'], [61, '9'],
            [62, 'ba'], [63, 'bb'], [3843, '99'], [3844, 'baa'], [3845, 'bab']
        ].forEach(function(elem){
            mongox.encodeBaseX(elem[0]).should.equal(elem[1]);
            mongox.decodeBaseX(elem[1]).should.equal(elem[0]);
        });
    });

    it("encode && decode althorithm should be changable", function(){
        for(var i = 0; i < 100; i++){
            mongox.decodeBaseX(mongox.encodeBaseX(i)).should.equal(i);
        }

        ['a', 'b', '9', 'ba', '99', 'baa', 'bbb'].forEach(function(elem){
            mongox.encodeBaseX(mongox.decodeBaseX(elem)).should.equal(elem);
        });
    });
});

var collections = {
    'mongoxTest': {
        columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
        enableCompact: true,
    },
    'mongoxTestBase62Map': {
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
describe("mongox main", function(){
    beforeEach(function(){
        mongox.initialize(config);
    });
    describe("initialize", function(){
        it("_id in columns", function(){
            try{
                mongox.initialize({collections:{'failedCol':{columns:["name", '_id'], enableCompact:true}}}).should.throwError('cannot contain _id in params.columns');
            }catch(e){};
        });
        it("no parms", function(){
            try{
                mongox.initialize().should.throwError('params must be Object');
            }catch(e){};
        });
        it("enableCompact default false", function(){
            mongox.initialize({collections:collections});
            should.deepEqual(mongox.getColumnNameMap('mongoxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongox.getColumnNameMap('mongoxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongox.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongox.getColumnNameMap('dependOnBlockConfig'), {});
        });
        it("enableCompact outer true", function(){
            mongox.initialize({collections:collections, enableCompact: true});
            should.deepEqual(mongox.getColumnNameMap('mongoxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongox.getColumnNameMap('mongoxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongox.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongox.getColumnNameMap('dependOnBlockConfig'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
        });
        it("enableCompact outer false", function(){
            mongox.initialize({collections:collections, enableCompact: false});
            should.deepEqual(mongox.getColumnNameMap('mongoxTest'), { name: 'n', expireTime: 'e', deleteFlag: 'd' });
            should.deepEqual(mongox.getColumnNameMap('mongoxTestBase62Map'), { name: 'a', expireTime: 'b', deleteFlag: 'c' });
            should.deepEqual(mongox.getColumnNameMap('noCompactCol'), {});
            should.deepEqual(mongox.getColumnNameMap('dependOnBlockConfig'), {});
        });
        it("addCollection", function(){
            mongox.initialize({collections:collections, enableCompact: false});
            mongox.addCollection('newCollection', {
                columns: ['name2', 'expireTime2', 'deleteFlag2'],
                enableCompact: true,
            });
            should.deepEqual(mongox.getColumnNameMap('newCollection'), { name2: 'a', expireTime2: 'b', deleteFlag2: 'c' });
        });
    });

    describe("translate", function(){
        var orignalRecord = {_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4};
        var compactRecord = {_id: 1, n: 1, e: 2, d: 3, notConfiguredKey: 4};

        var orignalRecordBase62 = {_id: 1, name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4};
        var compactRecordBase62 = {_id: 1, a: 1, b: 2, c: 3, notConfiguredKey: 4};
        it("compress dot notation key", function(){
            mongox.initialize({collections:collections, enableCompact: false});

            mongox.translateToCompact('name.0', 'mongoxTest').should.equal('n.0');
            mongox.translateToCompact('notConfiguredKey.name', 'mongoxTest').should.equal('notConfiguredKey.name');
            mongox.translateToCompact('name.0', 'mongoxTestBase62Map').should.equal('a.0');
            mongox.translateToCompact('notConfiguredKey.name', 'mongoxTestBase62Map').should.equal('notConfiguredKey.name');
        });

        it("compress collection", function(){
            mongox.initialize(config);
            should.deepEqual(mongox.translateRecordToCompact(orignalRecord, 'mongoxTest'), compactRecord);
            should.deepEqual(mongox.translateRecordToOrignal(compactRecord, 'mongoxTest'), orignalRecord);

            should.deepEqual(mongox.translateRecordToCompact(orignalRecordBase62, 'mongoxTestBase62Map'), compactRecordBase62);
            should.deepEqual(mongox.translateRecordToOrignal(compactRecordBase62, 'mongoxTestBase62Map'), orignalRecordBase62);
        });

        it("no compress collection", function(){
            mongox.initialize(config);
            should.deepEqual(mongox.translateRecordToCompact(orignalRecord, 'noCompactCol'), orignalRecord);
            should.deepEqual(mongox.translateRecordToOrignal(compactRecord, 'noCompactCol'), compactRecord);
        });

        describe("translate query selector", function(){
            it('$or', function(){
                should.deepEqual(mongox.translateQuerySelectorToCompact(
                    {$or: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongoxTest'),
                    {$or: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('$and', function(){
                should.deepEqual(mongox.translateQuerySelectorToCompact(
                    {$and: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongoxTest'),
                    {$and: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('$nor', function(){
                should.deepEqual(mongox.translateQuerySelectorToCompact(
                    {$nor: [{name:'name', deleteFlag: 1}, {notConfiguredKey:'notConfiguredKey'}]}, 'mongoxTest'),
                    {$nor: [{n:'name', d: 1}, {notConfiguredKey:'notConfiguredKey'}]}
                );
            });

            it('complex', function(){
                should.deepEqual(mongox.translateQuerySelectorToCompact(
                    {$and: [{name:'name'}, {$or:[{deleteFlag:1}, {expireTime:{$gt:123456789}}]}]}, 'mongoxTest'),
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

                    should.deepEqual(mongox.translateUpdateOperatorToCompact(orignalRecord, 'mongoxTest'), compactRecord);
                });
            });
            it('$rename', function(){
                should.deepEqual(mongox.translateUpdateOperatorToCompact({$rename:{'expireTime': 'deleteFlag'}}, 'mongoxTest'), {$rename:{e: 'd'}});
            });
        });

        describe("translate sort array", function(){
            it("common", function(){
                should.deepEqual(mongox.translateSortArrayToCompact([['name', 1], ['expireTime', -1]], 'mongoxTest'), [['n', 1], ['e', -1]]);
            });
        });
    });

    describe("all mongodb api", function(){
        it("todo", function(){
            var mongox = require('../lib/mongox');
            mongox.initialize(config);

            //should.fail('todo');
        });
    });

});



// var db = new mongodb.Db('test', new mongodb.Server('localhost', 27017));
// db.open(function(err, db){
//     var collection = db.collection("mongoxTest");
// //     collection.insert([record, record], {w:1}, function(err, result){
// //         console.log(err, result);
// //     });
//
//
// var queryObj = {name: 2};
//     collection.find(queryObj).toArray(function(err, result){
//         console.log(err, queryObj, result);
//     });
// });