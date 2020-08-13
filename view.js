<!--/* trick indenter
var View = Object.create(null)
with (View) (function($) { "use strict"
Object.assign(View, { //*/

// create public variables here
views: {
	error: {
		render: function(id, query, type) {
			$main.className = 'errorMode'
			setTitle("[404] I DON'T KNOW WHAT A \""+type+"\" IS")
			console.log(x)
		}
	}
},
setTitle: function(text, icon) {
	$pageTitle.textContent = text
	$.document.title = text
},
getView: function(name) {
	return views[name] || views.error
}

<!--/* 
}) //*/

// create private variables here
// these will override public vars

var x = views

<!--/*
}(window)) //*/ // pass external values
