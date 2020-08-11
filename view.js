<!--/* trick indenter
var View = {}
with (View) {
	var $ = window
	Object.assign(View, { //*/
views: {
	error: {
		render: function(id, query, type) {
			$main.className = 'errorMode'
			setTitle("[404] I DON'T KNOW WHAT A \""+type+"\" IS")
		}
	}
},
setTitle: function(text, icon) {
	$pageTitle.textContent = text
	$.document.title = text
},
<!--/* 
})
} //*/
