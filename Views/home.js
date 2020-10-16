<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('', {
	init: function() {
	},
	start: function(id, query, render) {
		return Req.read([
			{"content~Pgallery": {
				type: 'program',
				limit: 1, sort: 'random',
				associatedkey: 'thumbnail', associatedvalue: "_%"
			}}
		],{}, function(e, resp) {
			if (e) {
				render(null)
				return
			}
			render(resp.Pgallery, resp)
		}, true)
	},
	className: 'home',
	render: function(gallery, resp) {
		setTitle("Welcome to SmileBASIC Source 2!")
		updateGallery(gallery[0])
	},
})

function updateGallery(page) {
	$galleryTitle.replaceChildren(Draw.galleryLabel(page))
	$galleryImage.src = ""
	$galleryImage.src = Req.fileURL(page.values.thumbnail)
}

<!--/*
}(window)) //*/ // pass external values
