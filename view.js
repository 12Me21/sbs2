<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"
Object.assign(View, { //*/

// create public variables here
views: {
	"": {
		className: 'homeMode',
		render: function() {
			setPath()
			var text = "Welcome to SmileBASIC Source 2!"
			var index = $.Math.random()*(text.length-1)|0
			text = text.substring(0,index)+text[index+1]+text[index]+text.substr(index+2)
			setTitle(text)
		}
	},
	login: {
		className: 'registerMode',
		render: function() {
			setPath()
			setTitle("Log-in or Create an Account")
		}
	},
	test: {
		className: 'testMode',
		render: function() {
			setPath()
			setTitle("Testing")
		}
	},
	user: {
		start: function(id, query, render) {
			return $.Req.getUserPage(id, render)
		},
		className: 'userMode',
		render: function(user, page) {
			setTitle(user.name)
		}
	}
},
errorView: {
	className: 'errorMode',
	render: function(id, query, type) {
		setPath()
		setTitle("[404] I DON'T KNOW WHAT A \""+type+"\" IS")
		console.log(x)
	}
},
getView: function(name) {
	return views[name] || errorView
},
setTitle: function(text, icon) {
	$pageTitle.textContent = text
	$.document.title = text
},
setPath: function(path) {
	$navPane.replaceChildren()
},

<!--/* 
}) //*/

// create private variables here
// these will override public vars

var x = views

<!--/*
}(window)) //*/ // pass external values
