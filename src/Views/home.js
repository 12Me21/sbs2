<!--/* trick indenter
with (View) (function($) { "use strict" //*/

add_view('', {
	init() {
	},
	start(id, query) {
		return [1, {
			chains: [
				['content~Pgallery', {
					type: 'program',
					limit: 1, sort: 'random',
					associatedkey: 'photos', associatedvalue: "_%"
				}],
				['user.0createUserId'],
				['category', {parentIds: [0]}],
			],
			fields: {},
			ext: {},
			check() { return true },
		}]
	},
	className: 'home',
	render(resp, ext) {
		let gallery = resp.Pgallery
		let categories = resp.category
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
