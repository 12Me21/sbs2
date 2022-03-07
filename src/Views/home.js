<!--/* trick indenter
with (View) (function($) { "use strict" //*/

add_view('', {
	init() {
	},
	start(id, query, render) {
		return [0, Req.read([
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
		}, true)]
	},
	className: 'home',
	render(gallery, categories, resp) {
		set_title("Welcome to SmileBASIC Source 2!")
		$homeCategories.fill()
		categories.forEach((cat)=>{
			let bar = Draw.entity_title_link(cat)
			bar.className += " linkBar bar rem1-5"
			$homeCategories.append(bar)
		})
		updateGallery(gallery[0])
	},
})

function updateGallery(page) {
	$galleryTitle.fill(Draw.gallery_label(page))
	$galleryImage.src = ""
	let photos = Entity.parse_numbers(page.values.photos)
	if (photos && photos[0])
		$galleryImage.src = Req.file_url(photos[0])
}

<!--/*
}(window)) //*/
