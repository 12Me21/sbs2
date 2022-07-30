'use strict'

class ImagesView extends BaseView {
	Start(location) {
		this.current = null
		this.user = null
		
		let bucket = location.query.bucket
		let page = (location.query.page|0) || 1
		// TODO: bucket search
		let search = "contentType = @file"
		if (bucket)
			search += " AND !valuelike(@key, @bucket)"
		this.page = page
		this.bucket = bucket
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
		}
	}
	Init() {
		this.$whatever.innerHTML = ''
		// FIXME: should put this in another function since it's also
		// done in the file view
		this.$set_avatar.onclick = () => {
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
		this.$prev.onclick = e=>{go(-1)}
		this.$next.onclick = e=>{go(1)}
		let go = (dir)=>{
			let page = this.page || 1
			if (page+dir<1)
				return
			this.location.query.page = page+dir
			this.Slot.load_location(this.location)
		}
		// should be after enter press or something (wrap in a <form> or whatever, and then the prev/next can be submit buttons?)
		this.$bucket.onchange = e=>{
			this.location.query.bucket = this.$bucket.value||null
			this.Slot.load_location(this.location)
		}
		
		this.$in_sidebar.onclick = e=>{
			if (!this.current)
				return
			FileUploader.show_content(this.current)
			Sidebar.tabs.select('file')
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
		this.$data.fill(this.form.elem)
	}
	Render({content, user}) {
		this.user = user
		View.set_title(" Images ")
		for (let file of content) {
			const img = document.createElement('img')
			img.src = Req.file_url(file.hash, "size=60")
			img.onclick = e=>{this.select_image(file)}
			//let meta = JSON.parse(file.meta)
			this.$whatever.append(img)
		}
		this.$page.textContent = this.page
		this.$bucket.value = this.bucket||""
		this.select_image(null)
	}
	
	select_image(content) {
		this.current = content
		this.$image.src = "" // always set this, otherwise the old image will be visible until the new one loads
		if (!content) {
			this.$image_link.href = ""
			this.$image_link.textContent = ""
			return
		}
		this.$image.src = Req.file_url(content.hash)
		this.$image_link.href = `#page/${content.id}`
		this.$image_link.textContent = content.hash
		this.$image_link.textContent += " "+Draw.time_string(content.createDate2)
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
<view-root class='COL'>
	<div $=whatever class='images-thumbnails'></div>
	<div class='nav ROW rem1-5'>
		<button $=prev>◀prev</button>
		<span $=page class='textItem'>0</span>
		<button $=next>next▶</button>
		<input $=bucket placeholder="bucket">
	</div>
	<div class='FILL ROW'>
		<div class='FILL images-container'>
			<img $=image class='images-current'>
		</div>
		<div style="width:50%">
			<a $=image_link></a>
			<button $=set_avatar>Set Avatar</button>
			<button $=in_sidebar>show in sidebar</button>
			<div $=data></div>
		</div>
	</div>
</view-root>
`

View.register('images', ImagesView)
