'use strict'

let IMG_PER_PAGE = 30

class ImagesView extends BaseView {
	Start(location) {
		this.current = null
		
		let bucket = location.query.bucket
		let page = (location.query.page|0) || 1
		this.page = page
		this.bucket = bucket
		
		let search = "contentType = {{3}}"
		if (bucket)
			search += " AND !valuelike({{bucket}}, @bucket)"
		return {
			chain: {
				values: {
					bucket: JSON.stringify(bucket),
				},
				requests: [
					{type: 'content', fields: '*', query: search, order: 'id_desc', limit: IMG_PER_PAGE, skip: (page-1)*IMG_PER_PAGE},
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
	}
	Render({content, user}) {
		let title = " Images "
		if (this.bucket)
			title += "("+this.bucket+")"
		this.Slot.set_title(title)
		
		for (let file of content) {
			// heck (todo: put this somewhere better?)
			let meta = file.Meta = new FileMeta(file, user[~file.createUserId])
			
			let bg = '#DDD'
			
			function round(x) {
				if (x % 2 == 0.5)
					return Math.floor(x)
				return Math.round(x)
			}
			
			let div = document.createElement('div')
			
			if (meta.width) {
				let max = Math.max(meta.width, meta.height)
				// this needs to be changed to round 0.5 to nearest even #?
				let width = round(meta.width / max * AVATAR_SIZE)
				let height = round(meta.height / max * AVATAR_SIZE)
				bg = `no-repeat linear-gradient(orange, red) center / ${width+2}px ${height+2}px, ` + bg
				/*div.style.width = width+"px"
				div.style.height = height+"px"*/
			}
			
			let url = Req.image_url(file.hash, AVATAR_SIZE)
			
			bg = `no-repeat url("${url}") center, ` + bg
			
			if (!Entity.has_perm(file.permissions, 0, 'R'))
				bg = `no-repeat url(resource/hiddenpage.png) top left / 20px, ` + bg
			
			div.style.background = bg
			
			div.title = file.name // todo: more
			
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
		this.$image_show.hidden = !content
		if (!content)
			return
		
		let meta = content.Meta
		
		this.$image.style.aspectRatio = meta.width+" / "+meta.height
		this.$image.src = Req.image_url(content.hash)
		
		this.$image_link.href = `#page/${content.id}`
		this.$filename.textContent = content.name2
		//this.$hash.textContent = content.hash
		
		let x = Draw.user_label(meta.createUser)
		x.classList.add('user-label2')
		this.$author.fill(x)
		
		this.$image_type.textContent = content.literalType.replace("image/", "").toUpperCase()
		this.$image_kb.textContent = Math.round(meta.size/1000)
		this.$image_width.textContent = meta.width
		this.$image_height.textContent = meta.height
		this.$image_quantize.textContent = meta.quantize || ""
		
		this.$date.textContent = Draw.time_string(content.createDate2)
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
	<div class='FILL ROW' $=image_show hidden>
		<div class='images-container' style="width:50%">
			<img $=image class='images-current'>
		</div>
		<div class='COL images-data FILL'>
			<a $=image_link style='font-weight:bold;text-decoration:underline;'>
				<span $=filename class='pre'></span>
			</a>
			<div $=meta class='images-meta'>
				<b $=image_type></b>
				<span><b $=image_kb></b>kB</span>
				<span><b $=image_width></b>×<b $=image_height></b></span>
				<span>q<b $=image_quantize></b></span>
			</div>
			<div>
				<span $=author></span>
				<time $=date style='margin-left: 0.5rem'></time>
			</div>
			<div>
				<button $=set_avatar>Set Avatar</button>
				<button $=in_sidebar>show in sidebar</button>
			</div>
		</div>
	</div>
</view-root>
`

View.register('images', ImagesView)
