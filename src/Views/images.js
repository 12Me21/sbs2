'use strict'

class ImagesView extends BaseView {
	Init() {
		this.current = null
		this.page = null
		this.user = null
		this.SIZE = 60
		this.PER_PAGE = 20
		
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
				['bucket', 'text', {label: "Bucket"}],
				['values', 'text', {label: "Values"}], // todo: add an input type for like, json or specifically these values types idk
				['meta', 'output', {label: "Meta"}],
				['permissions', 'text', {label: "Permissions"}], //could be a real permission editor but image permissions don't really work anyway
				//['size', 'output', {output: true, label: "Size"}], I wish
				// ['quantization', 'output', {label: "Quantization"}],
			]
		})
		this.$imagesForm.fill(this.form.elem)
	}
	Start({id, query}) {
		const {page=1, bucket=null} = query;
		// TODO: bucket search
		return {
			chain: {
				values: {
					file: 3,
					key: 'bucket',
					bucket: JSON.stringify(bucket),
				},
				requests: [
					{
						type: 'content',
						fields: '*',
						query: `contentType = @file AND ${bucket ? '!valuelike(@key, @bucket)' : '!valuekeynotlike(@key)'}`,
						order: 'id_desc',
						limit: this.PER_PAGE,
						skip: (page-1) * this.PER_PAGE,
					},
					{type:'user', fields:'*', query:"id IN @content.createUserId."},
				],
			},
			ext: {page, bucket},
		}
	}
	Render({content, user}, {page, bucket}, location) {
		this.location = location
		this.page = page|0
		this.user = user
		View.set_title(" Images ")
		content.forEach(x=>{
			const img = document.createElement('img')
			img.src = Req.file_url(x.hash, `size=${this.SIZE}`)
			img.onclick = e=>{this.select_image(x)}
			let meta = JSON.parse(x.meta)
			/*if (meta.width && meta.height) {
				img.width = meta.width
				img.height = meta.height
			}*/
			this.$imagesWhatever.append(img)
		})
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
		this.$imagesCurrentLink.href = `#file/${content.id}`
		this.$imagesCurrentLink.textContent = content.hash
		const formData = {
			user: this.user[~content.createUserId],
			filename: content.name,
			bucket: content.values.bucket,
			// fixme: what is this for exactly?
			values: JSON.stringify(content.values),
			meta: content.meta,
			permissions: JSON.stringify(content.permissions)
		}
		this.form.set(formData)
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
