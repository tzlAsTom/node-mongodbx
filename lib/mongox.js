'use strict';

var mongodb = require('mongodb');

function mongox(){}

var config;

mongox._initialize = function(){
    config = {};

    config.collections = {};
    config.enableCompact = false;
};
// var config = {
//     'collections':{
//         'mongoxTest': {
//             columns: ['name', 'expireTime', 'deleteFlag'],
//             enableCompact: true, //collection scope config(higher precedence over module scope config)
//         }
//     },
//     enableCompact: true/false(default false) //module scope config
// };
mongox.initialize = function(params){
    if(config) throw Error('already initialized');

    mongox._initialize();
    if(!(params instanceof Object)) throw Error('params must be Object');

    config.enableCompact = (params.enableCompact === true)?true:false;
    if(params.collections && !(params instanceof Object)) throw Error('params.collections must be Object');
    if(params.collections) config.collections = params.collections;

    Object.keys(config.collections).forEach(function(collectionName){
        mongox.addCollection(collectionName, config.collections[collectionName]);
    });
};

mongox.addCollection = function(collectionName, params){
    if(!config) mongox._initialize();

    if(!collectionName) throw Error('collectionName missing');
    if(!(params instanceof Object)) throw Error('params must be Object');

    config.collections[collectionName] = {};
    config.collections[collectionName].enableCompact =  (typeof params.enableCompact === 'boolean')?params.enableCompact:config.enableCompact;
    if(config.collections[collectionName].enableCompact === false){
        config.collections[collectionName].columns = [];
    }else{
        if(!(params.columns instanceof Array)) throw Error('params.columns must be Array');
        config.collections[collectionName].columns = params.columns;
    }

    config.collections[collectionName].columnIndexHash = {};
    //use column name's index number in columns to compress
    config.collections[collectionName].columns.forEach(function(elem, index){
        //protect _id
        if(elem === '_id') throw Error('cannot contain _id in params.columns');

        config.collections[collectionName].columnIndexHash[elem] = index;
    });
};

//for debug
//{ name: 'a', expireTime: 'b', deleteFlag: 'c' }
mongox.getColumnNameMap = function(collectionName){
    if(!config && config.collections[collectionName]) return {};

    var rtn = {};
    config.collections[collectionName].columns.forEach(function(columnName){
        rtn[columnName] = mongox.translateToCompact(columnName, collectionName);
    });

    return rtn;
};

mongox._charset = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
mongox._charsetNumber = mongox._charset.length;
mongox._charsetIndexHash = {};
mongox._charset.forEach(function(elem, index){
    mongox._charsetIndexHash[elem] = index;
});

//1 => 'a', 2 => 'b', 62 => 'ba'
mongox.encodeBaseX = function(value){
    var rtn = '';

    var n = mongox._charsetNumber;
    var remainValue = value;
    var curValue = value;
    while(remainValue >= n){
        curValue = remainValue % n;
        remainValue = (remainValue - curValue)/n;

        rtn = mongox._charset[curValue] + rtn;
    }

    if(remainValue || rtn === ''){
        rtn = mongox._charset[remainValue] + rtn;
    }

    return rtn;
};

//'a' => 1, 'b' => 2, 'ba' => 62
mongox.decodeBaseX = function(input){
    var rtn = 0;

    for(var i = 0; i < input.length; i++){
        rtn *= mongox._charsetNumber;
        rtn += mongox._charsetIndexHash[input.charAt(i)];
    }

    return rtn;
};

//'a' => 'name', 'b' => 'expireTime, 'c' => 'deleteFlag', 'notConfiguredKey' => 'notConfiguredKey'
mongox.translateToOrignal = function(encodeStr, collectionName){
    if(encodeStr === '_id') return encodeStr;

    var curIndex = mongox.decodeBaseX(encodeStr);

    return (config && config.collections[collectionName] && (config.collections[collectionName].columns[curIndex] !== undefined))?config.collections[collectionName].columns[curIndex]:encodeStr;
};

//'name' => 'a', 'expireTime' => 'b', 'deleteFlag' => 'c', 'notConfiguredKey' => 'notConfiguredKey'
mongox.translateToCompact = function(inputStr, collectionName){
    if(inputStr === '_id') return inputStr;

    var curIndex = config && config.collections[collectionName] && config.collections[collectionName].columnIndexHash[inputStr];
    if(curIndex === undefined) return inputStr;

    return mongox.encodeBaseX(curIndex);
};

//{ name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4 }
//  =>
//{ a: 1, b: 2, c: 3, notConfiguredKey: 4 }
mongox.translateRecordToCompact = function(record, collectionName){
//todo: support dot notation
    if(!(config && config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    if(record instanceof Array){
        var rtn = [];
        record.forEach(function(elem){
            rtn.push(mongox.translateRecordToCompact(elem, collectionName));
        });

        return rtn;
    }else{
        var rtn = {};

        Object.keys(record).forEach(function(elem){
            rtn[ mongox.translateToCompact(elem, collectionName) ] = record[elem];
        });

        return rtn;
    }
};

//{ a: 1, b: 2, c: 3, notConfiguredKey: 4 }
//  =>
//{ name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4 }
mongox.translateRecordToOrignal = function(record, collectionName){
//todo: support dot notation
    if(!(config && config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    if(record instanceof Array){
        var rtn = [];
        record.forEach(function(elem){
            rtn.push(mongox.translateRecordToOrignal(elem, collectionName));
        });

        return rtn;
    }else{
        var rtn = {};

        Object.keys(record).forEach(function(elem){
            rtn[ mongox.translateToOrignal(elem, collectionName) ] = record[elem];
        });

        return rtn;
    }
};

//mongodb api injection
(function (){
// return;
    var oriInsert = mongodb.Collection.prototype.insert;
    mongodb.Collection.prototype.insert = function(){
        //todo: mongodb will append _id to arguments[0], but get lost when reassign
        arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);
        oriInsert.apply(this, arguments);
    };

    var oriRemove = mongodb.Collection.prototype.remove;
    mongodb.Collection.prototype.remove = function(){
        if(arguments[0] && !(arguments[0] instanceof Function)) arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);

        oriRemove.apply(this, arguments);
    };

    var oriSave = mongodb.Collection.prototype.save;
    mongodb.Collection.prototype.save = function(){
        //todo: see insert
        arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);
        oriSave.apply(this, arguments);
    };

    var oriUpdate = mongodb.Collection.prototype.update;
    //replace, $set, $inc, $unset...
    // http://docs.mongodb.org/manual/reference/operator/update/

    var oriFind = mongodb.Collection.prototype.find;
    mongodb.Collection.prototype.find = function(){
        arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);
        return oriFind.apply(this, arguments);
    };

    var oriToArray = mongodb.Cursor.prototype.toArray;
    mongodb.Cursor.prototype.toArray = function(callback){
        var self = this;
        oriToArray.call(this, function(err, result){
            if(err) return callback(err);

            return callback(null, mongox.translateRecordToOrignal(elem, self.namespace.collection));
        });
    };
})();

var record = {'name': 2, 'expireTime': 2, 'deleteFlag': 3, 'noExistsKey': 4};
var db = new mongodb.Db('test', new mongodb.Server('localhost', 27017));

mongox.initialize({
    'collections': {
        'mongoxTest': {
            columns: ['name', 'expireTime', 'deleteFlag'],
            enableCompact: true,
        },
        'noCompactCol': {
            columns: ['name', 'expireTime', 'deleteFlag'],
            enableCompact: false,
        },
        'dependOnBlockConfig': {
            columns: ['name', 'expireTime', 'deleteFlag'],
        }
    },
    enableCompact: true
});

db.open(function(err, db){
    var collection = db.collection("mongoxTest");
//     collection.insert(record, {w:1}, function(err, result){
//         console.log(err, result, record);
//
//         collection.remove(function(err, result){
//             console.log(err, result);
//         });
//     });

    collection.save(record, {w: 1}, function(err, result){
        console.log(err, result, record);
    });


// var queryObj = {name: 2};
//     collection.find(queryObj).toArray(function(err, result){
//         console.log(err, queryObj, result);
//     });
});


module.exports = mongox;

