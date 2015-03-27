'use strict';

var mongodb = require('mongodb');
var util = require('util');

function mongox(){}

var config = {
    collections: {},
    enableCompact: {},
    debug: false,
};
// var config = {
//     'collections':{
//         'mongoxTest': {
//             columns: ['name', 'expireTime', 'deleteFlag'],
//             enableCompact: true, //collection scope config(higher precedence over module scope config)
//         },
//         'mongoxTestMap: {
//             columns: {'name': 'n', 'expireTime': 'e', 'deleteFlag': 'd'},
//             enableCompact: true,
//         },
//     },
//     enableCompact: true/false(default false) //module scope config
//     debug: true/false(default(false))
// };
mongox.initialize = function(params){
    if(!(params instanceof Object)) throw Error('params must be Object');

    config.enableCompact = (params.enableCompact === true)?true:false;
    config.debug = (params.debug === true)?true:false;
    if(params.collections){
        if(!(params instanceof Object)) throw Error('params.collections must be Object');
        Object.keys(params.collections).forEach(function(collectionName){
            mongox.addCollection(collectionName, params.collections[collectionName]);
        });
    }
};

mongox.addCollection = function(collectionName, params){
    if(!collectionName) throw Error('collectionName missing');
    if(!(params instanceof Object)) throw Error('params must be Object');

    config.collections[collectionName] = {};
    config.collections[collectionName].enableCompact =  (typeof params.enableCompact === 'boolean')?params.enableCompact:config.enableCompact;
    if(config.collections[collectionName].enableCompact === false){
        config.collections[collectionName].columns = [];
    }else{
        if(!(params.columns instanceof Array || params.columns instanceof Object)) throw Error('params.columns must be Array');
    }

    if(params.columns instanceof Array){
        config.collections[collectionName].columns = params.columns;
        config.collections[collectionName].columnIndexHash = {};
        //use column name's index number in columns to compress
        config.collections[collectionName].columns.forEach(function(elem, index){
            //protect _id
            if(elem === '_id') throw Error('cannot contain _id in params.columns');

            config.collections[collectionName].columnIndexHash[elem] = index;
        });
    }else{
        config.collections[collectionName].columnNameMap = params.columns;
        config.collections[collectionName].columnNameReverseMap = {};
        Object.keys(config.collections[collectionName].columnNameMap).forEach(function(elem){
            config.collections[collectionName].columnNameReverseMap[ config.collections[collectionName].columnNameMap[elem] ] = elem;
        });
    }
};

//for debug
//{ name: 'a', expireTime: 'b', deleteFlag: 'c' }
mongox.getColumnNameMap = function(collectionName){
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return {};

    if(config.collections[collectionName].columnNameMap) return config.collections[collectionName].columnNameMap;

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
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return encodeStr;

    var collectionConfig = config.collections[collectionName];
    if(collectionConfig.columnNameReverseMap){
        return collectionConfig.columnNameReverseMap[encodeStr] || encodeStr;
    }else{
        var curIndex = mongox.decodeBaseX(encodeStr);

        return (collectionConfig.columns[curIndex] !== undefined)?collectionConfig.columns[curIndex]:encodeStr;
    }
};

//'name' => 'a', 'expireTime' => 'b', 'deleteFlag' => 'c', 'notConfiguredKey' => 'notConfiguredKey'
mongox.translateToCompact = function(inputStr, collectionName){
    if(inputStr === '_id') return inputStr;
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return inputStr;

    var collectionConfig = config.collections[collectionName];
    //for dot notation in query selector && update operator
    var dotIndex = inputStr.indexOf('.');
    if(dotIndex != -1){
        var keyName = inputStr.slice(0, dotIndex);
        var compactKeyName;
        if(collectionConfig.columnNameMap){
            compactKeyName = collectionConfig.columnNameMap[keyName];
        }else{
            var curIndex = config.collections[collectionName].columnIndexHash[keyName];
            if(curIndex !== undefined) compactKeyName = mongox.encodeBaseX(curIndex)
        }

        if(compactKeyName === undefined) return inputStr;

        return compactKeyName + inputStr.slice(dotIndex);
    }else{
        if(collectionConfig.columnNameMap){
            return collectionConfig.columnNameMap[inputStr] || inputStr;
        }else{
            var curIndex = config.collections[collectionName].columnIndexHash[inputStr];
            if(curIndex === undefined) return inputStr;

            return mongox.encodeBaseX(curIndex);
        }
    }
};

//{ name: 1, expireTime: 2, deleteFlag: 3, notConfiguredKey: 4 }
//  =>
//{ a: 1, b: 2, c: 3, notConfiguredKey: 4 }
mongox.translateRecordToCompact = function(record, collectionName){
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

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
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    if(record instanceof Array){
        var rtn = [];
        record.forEach(function(elem){
            rtn.push(mongox.translateRecordToOrignal(elem, collectionName));
        });

        return rtn;
    }else if(record instanceof Object){
        var rtn = {};

        Object.keys(record).forEach(function(elem){
            rtn[ mongox.translateToOrignal(elem, collectionName) ] = record[elem];
        });

        return rtn;
    }else{
        return rtn;
    }
};

//http://docs.mongodb.org/manual/reference/operator/query/
// $and, $or, $nor
// Note: $where not supported
mongox.translateQuerySelectorToCompact = function(record, collectionName){
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    var rtn = {};
    Object.keys(record).forEach(function(selector){
        if((selector == '$and') || (selector == '$or') || (selector == '$nor')){
            rtn[selector] = [];
            record[selector].forEach(function(elem){
                rtn[selector].push(mongox.translateQuerySelectorToCompact(elem, collectionName));
            });
        }else{
            rtn[ mongox.translateToCompact(selector, collectionName) ] = record[selector];
        }
    });

    return rtn;
};

//http://docs.mongodb.org/manual/reference/operator/update/
//
var updateOperatorWithSubRecord = {
    '$inc':  1,
    '$mul':  1,
    '$setOnInsert':  1,
    '$set': 1,
    '$unset': 1,
    '$min': 1,
    '$max': 1,
    '$currentDate': 1,
    '$addToSet': 1,
    '$pop': 1,
    '$pullAll': 1,
    '$pull': 1,
    '$pushAll': 1,
    '$push': 1,
    '$bit': 1,
};
mongox.translateUpdateOperatorToCompact = function(record, collectionName){
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    var rtn = {};
    Object.keys(record).forEach(function(operator){
        if(updateOperatorWithSubRecord[operator]){
            rtn[operator] = mongox.translateRecordToCompact(record[operator], collectionName);
        }else if(operator == '$rename'){//translate value too
            var temp = {};
            Object.keys(record[operator]).forEach(function(elem){
                temp[ mongox.translateToCompact(elem, collectionName) ] = mongox.translateToCompact(record[operator][elem], collectionName)
            });
            rtn[operator] = temp;
        }else{
            rtn[ mongox.translateToCompact(operator, collectionName) ] = record[operator];
        }
    });

    return rtn;
};

mongox.translateSortArrayToCompact = function(record, collectionName){
    if(!(config.collections[collectionName] && config.collections[collectionName].enableCompact)) return record;

    var rtn = [];
    record.forEach(function(sortArrayElem){
        rtn.push([mongox.translateToCompact(sortArrayElem[0], collectionName), sortArrayElem[1]]);
    });

    return rtn;
};

function logBefore(){
    var logStr = __filename + '. Before compact: ';
    for(var i = 0; i < arguments.length; i++) logStr += ((i != 0)?', ':'') + util.inspect(arguments[i]);
    console.info(logStr);
};
function logAfter(){
    var logStr = __filename + '. After  compact: ';
    for(var i = 0; i < arguments.length; i++) logStr += ((i != 0)?', ':'') + util.inspect(arguments[i]);
    console.info(logStr);
};

//mongodb api injection
//todo use clone?
(function (){
// return;
    var oriInsert = mongodb.Collection.prototype.insert;
    mongodb.Collection.prototype.insert = function(){
        //todo: mongodb will append _id to arguments[0], but get lost with reassign
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
    mongodb.Collection.prototype.update = function(){
        if(config.debug) logBefore(arguments[0], arguments[1]);
        arguments[0] = mongox.translateQuerySelectorToCompact(arguments[0], this.s.name);
        arguments[1] = mongox.translateUpdateOperatorToCompact(arguments[1], this.s.name);
        if(config.debug) logAfter(arguments[0], arguments[1]);

        oriUpdate.apply(this, arguments);
    };

    var oriDistinct = mongodb.Collection.prototype.distinct;
    mongodb.Collection.prototype.distinct = function(){
        if(config.debug) (arguments[1] instanceof Function)?logBefore(arguments[0]):logBefore(arguments[0], arguments[1]);
        arguments[0] = mongox.translateToCompact(arguments[0], this.s.name);
        if(!(arguments[1] instanceof Function)) arguments[1] = mongox.translateQuerySelectorToCompact(arguments[1], this.s.name);
        if(config.debug) (arguments[1] instanceof Function)?logAfter(arguments[0]):logAfter(arguments[0], arguments[1]);

        oriDistinct.apply(this, arguments);
    };

    var oriCount = mongodb.Collection.prototype.count;
    mongodb.Collection.prototype.count = function(){
        if(!(arguments[0] instanceof Function)){
            if(config.debug) logBefore(arguments[0]);
            arguments[0] = mongox.translateQuerySelectorToCompact(arguments[0], this.s.name);
            if(config.debug) logAfter(arguments[0]);
        }

        oriCount.apply(this, arguments);
    };

    var oriFindAndModify = mongodb.Collection.prototype.findAndModify;
    mongodb.Collection.prototype.findAndModify = function(){
        if(config.debug) logBefore(arguments[0], arguments[1], arguments[2]);
        arguments[0] = mongox.translateQuerySelectorToCompact(arguments[0], this.s.name);
        arguments[1] = mongox.translateSortArrayToCompact(arguments[1], this.s.name);
        if(arguments[2]) arguments[2] = mongox.translateUpdateOperatorToCompact(arguments[2], this.s.name);
        if(config.debug) logAfter(arguments[0], arguments[1], arguments[2]);

        var oriCallback = arguments[arguments.length - 1];
        var collectionName = this.s.name;
        arguments[arguments.length - 1] = function(err, result){
            if(!err && result && result.value){
                result.value = mongox.translateRecordToOrignal(result.value, collectionName);
            }

            return oriCallback(err, result);
        };

        oriFindAndModify.apply(this, arguments);
    };

/*
    //mongodb driver call findAndModify for findAndRemove. Donot need inject.
    var oriFindAndRemove = mongodb.Collection.prototype.findAndRemove;
    mongodb.Collection.prototype.findAndRemove = function(){
        if(config.debug) logBefore(arguments[0], arguments[1]);
        arguments[0] = mongox.translateQuerySelectorToCompact(arguments[0], this.s.name);
        arguments[1] = mongox.translateSortArrayToCompact(arguments[1], this.s.name);
        if(config.debug) logAfter(arguments[0], arguments[1]);

        oriFindAndRemove.apply(this, arguments);
    };
*/

//Various argument possibilities
//         callback?
//         selector, callback?,
//         selector, fields, callback?
//         selector, options, callback?
//         selector, fields, options, callback?
//         selector, fields, skip, limit, callback?
//         selector, fields, skip, limit, timeout, callback?
//
    var testForFields = {
        limit: 1, sort: 1, fields:1, skip: 1, hint: 1, explain: 1, snapshot: 1, timeout: 1, tailable: 1, tailableRetryInterval: 1
        , numberOfRetries: 1, awaitdata: 1, awaitData: 1, exhaust: 1, batchSize: 1, returnKey: 1, maxScan: 1, min: 1, max: 1, showDiskLoc: 1
        , comment: 1, raw: 1, readPreference: 1, partial: 1, read: 1, dbName: 1, oplogReplay: 1, connection: 1, maxTimeMS: 1, transforms: 1
    }

    var oriFind = mongodb.Collection.prototype.find;
    mongodb.Collection.prototype.find = function(){
        if(config.debug) logBefore.apply(undefined, arguments);

        var noCallback = (arguments[arguments.length - 1] instanceof Function)?0:1;
        if(arguments.length >= 2 - noCallback){
            arguments[0] = mongox.translateQuerySelectorToCompact(arguments[0], this.s.name);
            var optionsIndex, fieldsIndex;
            if(arguments.length == 3 - noCallback){
                var fieldOrOptionKeys = Object.keys(arguments[1]);
                var isOption = false;
                for(var i = 0; i < fieldOrOptionKeys.length; i++){
                    if(testForFields[fieldOrOptionKeys[i]]){
                        isOption = true;
                        break;
                    }
                }

                isOption?(optionsIndex = 1):(fieldsIndex = 1);
            }else if(arguments.length - noCallback >= 4){
                fieldsIndex = 1;
            }

            if(fieldsIndex){
                arguments[fieldsIndex] = mongox.translateRecordToCompact(arguments[fieldsIndex], this.s.name);
            }else if(optionsIndex){
                var options = arguments[optionsIndex];
                if(options.fields) options.fields = mongox.translateRecordToCompact(options.fields, this.s.name);
                if(options.sort) options.sort = mongox.translateSortArrayToCompact(options.sort, this.s.name);
            }
        }
        if(config.debug) logAfter.apply(undefined, arguments);

        return oriFind.apply(this, arguments);
    };

    //mongodb driver call find for findOne

    var oriCreateIndex = mongodb.Collection.prototype.createIndex;
    mongodb.Collection.prototype.createIndex = function(){
        if(config.debug) logBefore(arguments[0]);
        if(typeof arguments[0] === 'string'){
            arguments[0] = mongox.translateToCompact(arguments[0], this.s.name);
        }else{
            arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);
        }
        if(config.debug) logAfter(arguments[0]);

        oriCreateIndex.apply(this, arguments);
    };

    var oriEnsureIndex = mongodb.Collection.prototype.ensureIndex;
    mongodb.Collection.prototype.ensureIndex = function(){
        if(config.debug) logBefore(arguments[0]);
        if(typeof arguments[0] === 'string'){
            arguments[0] = mongox.translateToCompact(arguments[0], this.s.name);
        }else{
            arguments[0] = mongox.translateRecordToCompact(arguments[0], this.s.name);
        }
        if(config.debug) logAfter(arguments[0]);

        oriEnsureIndex.apply(this, arguments);
    };

    //Note: mapReduce not supported

    //Note: group not supported

    var oriGeoNear = mongodb.Collection.prototype.geoNear;
    mongodb.Collection.prototype.geoNear = function(){
        if(arguments.length == 4){
            if(config.debug) logBefore(arguments[2]);
            if(arguments[2].query) arguments[2].query = mongox.translateQuerySelectorToCompact(arguments[2].query, this.s.name);
            if(config.debug) logAfter(arguments[2]);
        }

        oriGeoNear.apply(this, arguments);
    };

    var oriGeoHaystackSearch = mongodb.Collection.prototype.geoHaystackSearch;
    mongodb.Collection.prototype.geoHaystackSearch = function(){
        if(arguments.length == 4){
            if(config.debug) logBefore(arguments[2]);
            if(arguments[2].search) arguments[2].search = mongox.translateQuerySelectorToCompact(arguments[2].search, this.s.name);
            if(config.debug) logAfter(arguments[2]);
        }

        oriGeoHaystackSearch.apply(this, arguments);
    };

    //Note: aggregate not supported (todo)

//     var oriCursorToArray = mongodb.Cursor.prototype.toArray;
//     mongodb.Cursor.prototype.toArray = function(callback){
//         var self = this;
//         oriCursorToArray.call(this, function(err, result){
//             if(err) return callback(err);
//
//             return callback(null, mongox.translateRecordToOrignal(result, self.namespace.collection));
//         });
//     };

    //todo: check all cursor api(try core cursor
    var oriCursorNext = mongodb.Cursor.prototype.next;
    mongodb.Cursor.prototype.next = function(callback){
        var self = this;

        oriCursorNext.call(this, function(err, result){
            if(err) return callback(err);

            return callback(null, mongox.translateRecordToOrignal(result, self.namespace.collection));
        });
    };

    //todo: find how
    var oriCursorReadBufferedDocuments = mongodb.Cursor.prototype.readBufferedDocuments;
    mongodb.Cursor.prototype.readBufferedDocuments = function(){
        var rtn = oriCursorReadBufferedDocuments.apply(this, arguments);

        return mongox.translateRecordToOrignal(rtn, this.namespace.collection);
    };

    var oriCursorSort = mongodb.Cursor.prototype.sort;
    mongodb.Cursor.prototype.sort = function(){
        if(config.debug) logBefore(arguments[0]);
        if(typeof arguments[0] === 'string'){
            arguments[0] = mongox.translateToCompact(arguments[0], this.namespace.collection);
        }else{
            arguments[0] = mongox.translateSortArrayToCompact(arguments[0], this.namespace.collection);
        }
        if(config.debug) logAfter(arguments[0]);

        return oriCursorSort.apply(this, arguments);
    };

})();

module.exports = mongox;

