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
				['values', 'text', {label: "Values"}], // todo: add an input type for like, json or specifically these values types idk
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
			let div = document.createElement('div')
			
			let url = Req.file_url(file.hash, "size=60")
			let bg = `no-repeat url("${url}") center/contain, #DDD`
			if (!Entity.has_perm(file.permissions, 0, 'R'))
				bg = `no-repeat url(resource/hiddenpage.png) top left / 20px, ` + bg
			div.style.background = bg
			
			div.onclick = e=>{this.select_image(file)}
			this.$whatever.append(div)
		}
		this.$page.textContent = this.page
		this.$bucket.value = this.bucket||""
		this.select_image(null)
	}
	
	select_image(content) {
		this.current = content
		this.$image.src = "" // always set this, otherwise the old image will be visible until the new one loads
		if (!content)
			return
		this.$image.src = Req.file_url(content.hash)
		
		this.$image_link.href = `#page/${content.id}`
		this.$filename.textContent = content.name2
		this.$hash.textContent = content.hash
		
		let author = this.user[~content.createUserId]
		let x = Draw.user_label(author)
		x.classList.add('user-label2')
		this.$author.fill(x)
		
		let meta = content.meta ? JSON.parse(content.meta) : {}
		let info = content.literalType.replace("image/", "")+" | "+(meta.size/1000).toFixed(1)+" kB"+" | "+meta.width+"×"+meta.height
		if (meta.quantize)
			info += " | Q "+meta.quantize
		this.$meta.textContent = info
		
		this.$date.textContent = Draw.time_string(content.createDate2)
		
		this.form.set({
			values: JSON.stringify(content.values),
			permissions: JSON.stringify(content.permissions),
		})
		this.form.write()
	}
}

ImagesView.template = HTML`
<view-root class='COL'>
	<div $=whatever class='images-thumbnails'></div>
	<div class='nav rem1-5 ROW'>
		<button $=prev>◀prev</button>
		<span $=page>0</span>
		<button $=next>next▶</button>
		Bucket:
		<input $=bucket placeholder="bucket">
	</div>
	<div class='FILL ROW'>
		<div class='FILL images-container'>
			<img $=image class='images-current'>
		</div>
		<div style="width:50%" class='COL images-data'>
			<a $=image_link style='font-weight:bold'>
				[<span $=hash style='font:var(--T-monospace-font)'></span>] <span $=filename class='pre'></span>
			</a>
			<div $=meta></div>
			<div $=author></div>
			<time $=date></time>
			<button $=set_avatar>Set Avatar</button>
			<button $=in_sidebar>show in sidebar</button>
			<div $=data></div>
		</div>
	</div>
</view-root>
`

View.register('images', ImagesView)
