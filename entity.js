// functions for processing recieved entities/
// DATA PROCESSOR
//call it process or format or something
<!--/* trick indenter
var Process = Object.create(null)
with (Process) (function($) { "use strict"
Object.assign(Process, { //*/

process: function(resp) {
	for (var key in resp)
		processList(keyType(key), resp[key])
},
keyType: function(key) {
	return key
},
processList: function(type, data) {
	var proc = processItem[type]
	if (!proc) {
		console.warn('recvd unknown type', type, data)
		return // uh oh, unknown type
	}
	data.forEach(function(item, i, data) {
		// this is done in-place
		data[i] = proc(item)
	})
},
processItem: {
	user: function(data) {
		return data
	}
}

<!--/* 
}) //*/



<!--/*
}(window)) //*/ // pass external values
