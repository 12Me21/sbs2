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
				associatedkey: 'photos', associatedvalue: "_%"
			}},
			"user.0createUserId",
			{category: {parentIds: [0]}}
		],{}, function(e, resp) {
			if (e) {
				render(null)
				return
			}
			render(resp.Pgallery, resp.category, resp)
		}, true)
	},
	className: 'home',
	render: function(gallery, categories, resp) {
		setTitle("Welcome to SmileBASIC Source 2!")
		$homeCategories.replaceChildren()
		categories.forEach(function(cat) {
			var bar = Draw.entityTitleLink(cat)
			bar.className += " linkBar bar rem1-5"
			$homeCategories.appendChild(bar)
		})
		updateGallery(gallery[0])
	},
})

function updateGallery(page) {
	$galleryTitle.replaceChildren(Draw.galleryLabel(page))
	$galleryImage.src = ""
	console.log(page.values)
	var photos = page.values.photos.split(",")
	$galleryImage.src = Req.fileURL(+photos[0])
}

<!--/*
}(window)) //*/ // pass external values
