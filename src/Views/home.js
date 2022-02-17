<!--/* trick indenter
with (View) (function($) { "use strict" //*/

addView('', {
	init() {
	},
	start(id, query, render) {
		return Req.read([
			['content~Pgallery', {
				type: 'program',
				limit: 1, sort: 'random',
				associatedkey: 'photos', associatedvalue: "_%"
			}],
			['user.0createUserId'],
			['category', {parentIds: [0]}],
		],{}, (e, resp)=>{
			if (e)
				render(null)
			else
				render(resp.Pgallery, resp.category, resp)
		}, true)
	},
	className: 'home',
	render(gallery, categories, resp) {
		setTitle("Welcome to SmileBASIC Source 2!")
		$homeCategories.replaceChildren()
		categories.forEach((cat)=>{
			let bar = Draw.entityTitleLink(cat)
			bar.className += " linkBar bar rem1-5"
			$homeCategories.append(bar)
		})
		updateGallery(gallery[0])
	},
})

function updateGallery(page) {
	$galleryTitle.replaceChildren(Draw.galleryLabel(page))
	$galleryImage.src = ""
	let photos = Entity.parse_numbers(page.values.photos)
	if (photos && photos[0])
		$galleryImage.src = Req.fileURL(photos[0])
}

<!--/*
}(window)) //*/
