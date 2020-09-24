<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('template', {
	init: function() {
		// this is called when the page initially loads
		// (in the future, it may be deferred until the view is visited
		// for the first time)
	},
	start: function(id, query, render) {
		// this should make a request for data from the api
		// and call `render` when it's finished
		// DO NOT MODIFY ANY HTML IN THIS FUNCTION
		// If you don't need to load anything asynchronously,
		// you can leave out this function and `render` will be
		// called immediately instead (with arguments (id, query, type))
	},
	className: 'template', // <v-b data-view-template> blocks will be visible, and all other <v-b> blocks are hidden
	render: function() {
		// this function is called after the data is recieved, and
		// should render the page
	},
	cleanUp: function() {
		// this is called before switching to another page,
		// to remove any unneeded content that was created by `render`
	},
})

<!--/*
}(window)) //*/ // pass external values
