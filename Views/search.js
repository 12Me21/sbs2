<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('search', {
	init: function() {
		setTitle("Search")
	},
	className: 'searchMode',
	// todo: maybe support search params in url, and perform search immediately?
	render: function(id, query, render) {
		
	},
	cleanUp: function() {
		$searchResults.replaceChildren()
	}
})

<!--/*
}(window)) //*/ // pass external values
