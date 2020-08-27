// functions for processing recieved entities/
// DATA PROCESSOR
//call it process or format or something
<!--/* trick indenter
var Entity = Object.create(null)
with (Entity) (function($) { "use strict"
Object.assign(Entity, { //*/

categoryMap: null,
gotNewCategory: false,

process: function(resp) {
	// build user map first
	var users = {}
	for (var key in resp) {
		var type = keyType(key)
		if (type == 'user') {
			processList(type, resp[key], users)
			resp[key].forEach(function(user) {
				users[user.id] = user
			})
		}
	}
	if (resp.Ctree) {
		processList('category', resp.Ctree, users)
	}
	for (var key in resp) {
		var type = keyType(key)
		if (type != 'user' && key != 'Ctree')
			processList(type, resp[key], users)
	}
	if (gotNewCategory)
		rebuildCategoryTree()
	resp.userMap = users
},
keyType: function(key) {
	if (key[0] == "C")
		return "category"
	if (key[0] == "P")
		return "content"
	if (key[0] == "U")
		return "user"
	return key
},
processList: function(type, data, users) {
	var proc = processItem[type]
	if (!proc) {
		console.warn('recvd unknown type', type, data)
		return // uh oh, unknown type
	}
	if (type == 'category')
		gotNewCategory = true
	data.forEach(function(item, i, data) {
		// this is done in-place
		data[i] = proc(item, users)
		data[i].type = type
	})
},
processItem: {
	user: function(data, users) {
		if (data.createDate)
			data.createDate = parseDate(data.createDate)
		data.name = data.name || data.username
		return data
	},
	category: function(data, users) {
		var cat = categoryMap[data.id]
		if (!cat) {
			categoryMap[data.id] = cat = data
		} else {
			Object.assign(cat, data)
			data = cat
		}
		data = processItem.editable(data, users)
		return data
	},
	content: function(data, users) {
		data = processItem.editable(data, users)
		if (data.parentId != undefined)
			data.parent = categoryMap[data.parentId]
		return data
	},
	comment: function(data, users) {
		data = processItem.editable(data, users)
		if (data.content) {
			var m = decodeComment(data.content)
			data.content = m.t
			data.meta = m
		}
		return data
	},
	file: function(data, users) {
		return data
	},
	editable: function(data, users) {
		if (data.editUserId)
			data.editUser = users[data.editUserId]
		if (data.createUserId)
			data.createUser = users[data.createUserId]
		if (data.editDate)
			data.editDate = parseDate(data.editDate)
		if (data.createDate)
			data.createDate = parseDate(data.createDate)
		return data
	},
},
rebuildCategoryTree: function() {
	gotNewCategory = false
	for (var id in categoryMap)
		categoryMap[id].children = []
	// todo: make sure root category doesn't have parent
	for (var id in categoryMap) {
		var cat = categoryMap[id]
		var parent = categoryMap[cat.parentId] || categoryMap[0]
		parent.children.push(cat)
		if (cat.id != 0)
			cat.parent = parent
	}
},
// as far as I know, the o3DS doesn't support parsing ISO 8601 timestamps
parseDate: function(str) {
	if (!str)
		return new $.Date(0)
	var data = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:.\d+)?)/)
	if (!data)
		return new $.Date(0)
	var sec = $.Math.floor(+data[6])
	var ms = +data[6] - sec
	return new $.Date(Date.UTC(+data[1], +data[2]-1, +data[3], +data[4], +data[5], sec, ms))
},
decodeComment: function(content) {
	var newline = content.indexOf("\n")
	try {
		// try to parse the first line as JSON
		var data = JSON.parse(newline>=0 ? content.substr(0, newline) : content)
	} finally {
		if (data && data.constructor == Object) { // new or legacy format
			if (newline >= 0)
				data.t = content.substr(newline+1) // new format
		} else // raw
			data = {t: content}
		return data
	}
},
encodeComment: function(text, metadata) {
	return JSON.stringify(metadata || {})+"\n"+text
},

<!--/* 
}) //*/

categoryMap = {0: {
	name:"[root]",
	id:0,
	type:'category',
	description:"",
	values:{}
}}

<!--/*
}(window)) //*/ // pass external values
