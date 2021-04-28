<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('search', {
	init: function() {
	},
	className: 'searchMode',
	// todo: maybe support search params in url, and perform search immediately?
	render: function(id, query, render) {
		setTitle("Search")
	},
	cleanUp: function() {
		$searchResults.replaceChildren()
	}
})

<!--/*
}(window)) //*/
