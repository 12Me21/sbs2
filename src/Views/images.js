'use strict'

class ImagesView extends BaseView {
	Init() {
		this.current = null
		this.page = null
		this.user = null
		
		this.$imagesWhatever.innerHTML = ''
		// FIXME: should put this in another function since it's also
		// done in the file view
		this.$imagesAvatarButton.onclick = () => {
			if (!this.current) return
			Req.me.avatar = this.current.hash
			Req.write(Req.me).do = (resp, err)=>{
				if (!err)
					print('ok')
				else
					alert('edit failed')
			}
		}
		// FIXME: im pretty sure this is something that 12 wanted to be handled
		// by Draw?
		// FIXME: this is shit.
		this.$imagesPrev.onclick = e=>{go(-1)}
		this.$imagesNext.onclick = e=>{go(1)}
		let go = (dir)=>{
			let page = this.page || 1
			if (page+dir<1)
				return
			this.location.query.page = page+dir
			Nav.goto(this.location, true)
		}
		// should be after enter press or something (wrap in a <form> or whatever, and then the prev/next can be submit buttons?)
		this.$imagesNavBucket.onchange = e=>{
			this.location.query.bucket = this.$imagesNavBucket.value
			Nav.goto(this.location, true)
		}
		
		this.$imagesShowSidebar.onclick = e=>{
			if (!this.current)
				return
			FileUploader.show_content(this.current)
			Sidebar.select_tab('file')
		}
		
		this.form = new Form({
			fields: [
				['user', 'user_output', {label: "User"}],
				['filename', 'text', {label: "File Name"}],
				['values', 'text', {label: "Values"}], // todo: add an input type for like, json or specifically these values types idk
				['meta', 'output', {label: "Meta"}],
				['permissions', 'text', {label: "Permissions"}], //could be a real permission editor but image permissions don't really work anyway
				//['size', 'output', {output: true, label: "Size"}], I wish
				// ['quantization', 'output', {label: "Quantization"}],
			]
		})
		this.$imagesForm.fill(this.form.elem)
	}
	Start(location) {
		let bucket = location.query.bucket;
		let page = (location.query.page|0) || 1;
		// TODO: bucket search
		let search = "contentType = @file"
		if (bucket)
			search += " AND !valuelike(@key, @bucket)"
		return {
			chain: {
				values: {
					file: 3,
					key: 'bucket',
					bucket: JSON.stringify(bucket),
				},
				requests: [
					{type: 'content', fields: '*', query: search, order: 'id_desc', limit: 20, skip: (page-1)*20},
					{type:'user', fields:'*', query:"id IN @content.createUserId."},
				],
			},
			ext: {page, bucket},
		}
	}
	Render({content, user}, {page, bucket}) {
		this.page = page
		this.user = user
		View.set_title(" Images ")
		for (let file of content) {
			const img = document.createElement('img')
			img.src = Req.file_url(file.hash, "size=60")
			img.onclick = e=>{this.select_image(file)}
			//let meta = JSON.parse(file.meta)
			this.$imagesWhatever.append(img)
		}
		this.$imagesNavPage.textContent = page
		this.$imagesNavBucket.value = bucket
		this.select_image(null)
	}
	select_image(content) {
		this.current = content
		this.$imagesCurrentImg.src = "" // always set this, otherwise the old image will be visible until the new one loads
		if (!content) {
			this.$imagesCurrentLink.href = ""
			this.$imagesCurrentLink.textContent = ""
			return
		}
		this.$imagesCurrentImg.src = Req.file_url(content.hash)
		this.$imagesCurrentLink.href = `#page/${content.id}`
		this.$imagesCurrentLink.textContent = content.hash
		this.form.set({
			user: this.user[~content.createUserId],
			filename: content.name,
			values: JSON.stringify(content.values),
			meta: content.meta,
			permissions: JSON.stringify(content.permissions),
		})
		this.form.write()
	}
}

ImagesView.template = HTML`
<div class='COL'>
	<div $=imagesWhatever class='images-thumbnails'></div>
	<div $=imagesNav class='nav ROW rem1-5'>
		<button $=imagesPrev>◀prev</button>
		<span $=imagesNavPage class='textItem'>0</span>
		<button $=imagesNext>next▶</button>
		<input $=imagesNavBucket placeholder="bucket">
	</div>
	<div $=imagesCurrent class='FILL ROW'>
		<div $=imagesCurrentImgContainer class='FILL images-container'>
			<img $=imagesCurrentImg class='images-current'>
		</div>
		<div style="width:50%">
			<a $=imagesCurrentLink></a><button $=imagesAvatarButton>Set Avatar</button><button $=imagesShowSidebar>show in sidebar</button>
			<div $=imagesForm></div>
		</div>
	</div>
</div>
`

ImagesView.register('images')
