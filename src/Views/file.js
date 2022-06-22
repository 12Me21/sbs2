'use strict'

View.add_view('file', {
	current: null,
	Init() {
		$fileSetAvatar.onclick = e=>{
			if (!this.current)
				return
			Req.me.avatar = this.current.hash
			Req.write(Req.me).do = (resp, err)=>{
				if (!err)
					print('ok')
				else
					alert('edit failed')
			}
		}
		$fileShowSidebar.onclick = e=>{
			if (!this.current)
				return
			FileUploader.show_content(this.current)
			Sidebar.select_tab('file')
		}
	},
	Start({id, query}) {
		let field = 'number'==typeof id ? 'id' : 'hash'
		return {
			chain: {
				values: {
					key: id,
				},
				requests: [
					{type: 'content', fields: "*", query: `${field} = @key`},
					{type: 'user', fields: "*", query: "id IN @content.createUserId"},
				],
			},
			ext: {},
			check(resp) {
				return resp.content[0]
			},
		}
	},
	Render({user, content:[image]}, ext) {
		this.current = image
		View.set_title(image.name + " - " + image.hash)
		$fileImage.src = ""
		$fileImage.src = Req.file_url(image.hash)
		
		let meta = JSON.parse(image.meta)
		// old images don't have meta width/height, only quantize
		if (meta.width && meta.height) {
			$fileImage.width = meta.width
			$fileImage.height = meta.height
		} else {
			$fileImage.removeAttribute('width')
			$fileImage.removeAttribute('height')
		}
		
		$fileInfo.textContent = JSON.stringify(image, null, 1)
		$userPageLink.href = "#page/"+image.id
		let author = user[~image.createUserId]
		$fileAuthor.fill(Draw.user_label(author))
	},
	Cleanup(type) {
		this.current = null
		$fileImage.src = ""
	},
})
