class Uploader {
	constructor(f) {
		this.$f = f
		this.iimg = new Image()
		this.oimg = new Image()
		this.canvas = null
		
		// todo: if these change faster than we can encode the img
		// that's REALLY bad, we need to ratelimit this
		this.$f.quality.onchange = ev=>{
			this.encode_canvas(+ev.currentTarget.value, ()=>{
				this.oimg.onload = ev=>{
					this.show_details(this.oimg, 'resize')
					// todo: lets just have a single consistent callback
					// and then check whether we should call show_details
				}
			})
		}
		this.$f.resize.onchange = ev=>{
			if (ev.currentTarget.checked) {
				// todo: need to update oimg here
				this.show_details(this.oimg, 'resize')
			} else {
				this.show_details(this.iimg, 'fields')
			}
		}
		this.$f.scale.onchange = ev=>{
			let v = +ev.currentTarget.value
			this.$f.scale_num.value = v
			this.update_canvas(v)
		}
		this.$f.scale_num.onchange = ev=>{
			let v = +ev.currentTarget.value
			this.$f.scale.value = v
			this.update_canvas(v)
		}
		this.$f.browse.onchange = ev=>{
			let file = ev.currentTarget.files[0]
			ev.currentTarget.value = ""
			if (file)
				this.got_upload(file)
		}
	}
	
	got_upload(file) {
		this.done()
		//f.reset()
		this.$f.resize.checked = false
		this.$f.name.value = file.name
		//f.public.checked
		//f.bucket.value
		this.$f.hash.value = null
		
		this.blob_to_image(this.iimg, file, true)
		this.iimg.onload = ev=>{
			let w = this.iimg.naturalWidth
			this.$f.scale.value = this.$f.scale.max = w
			this.$f.scale_num.value = this.$f.scale_num.max = w
			this.show_details(this.iimg, 'fields')
		}
	}
	
	// free memory
	done() {
		this.blob_to_img(this.oimg)
		this.blob_to_img(this.iimg)
		this.canvas = null
	}
	
	update_canvas(dw) {
		let {naturalWidth:w, naturalHeight:h} = this.iimg
		if (!dw)
			dw = w
		let dh = Math.round(dw * h / w)
		
		if (!this.canvas)
			this.canvas = document.createElement('canvas')
		this.canvas.width = dw
		this.canvas.height = dh
		
		let c2d = this.canvas.getContext('2d')
		c2d.drawImage(this.iimg, 0, 0, dw, dh)
	}
	
	blob_to_img(blob, out, clear) {
		let img = out ? this.oimg : this.iimg
		img.onload = null
		if (img.src)
			URL.revokeObjectURL(img.src)
		if (!blob || clear)
			img.src = ""
		if (blob)
			img.src = URL.createObjectURL(blob)
	}
	
	// set oimg, call callback
	// todo: cancel this if the image changes etc.
	encode_canvas(quality, callback) {
		let type = quality ? 'image/jpeg' : 'image/png'
		this.canvas.toBlob(blob=>{
			this.blob_to_image(this.oimg, blob, false)
			callback()
		}, type, quality/100)
	}
	
	blob_to_image(img, file, clear) {
		img.dataset.type = file.type
		img.dataset.size = file.size
		this.set_src(img, file, clear)
	}
	
	show_details(img, page) {
		if (img !== this.shown) {
			this.$image_box.replaceChildren(img)
			this.shown = img
		}
		this.$f.dataset.page = page
		
		let size = +img.dataset.size
		if (size < 100e3) { // 0-100kb (green - yellow)
			size = (size) / (100e3)
			this.$color.style.backgroundColor = "rgb("+(size*255)+",255,0)"
		} else if (size < 2e6) { // 100kb - 2mb (yellow-red)
			size = (size-100e3) / (2e6-100e3)
			this.$color.style.backgroundColor = "rgb(255,"+((1-size)*255)+",0)"
		} else { // > 2mb (too large)
			this.$color.style.backgroundColor = "magenta"
		}
		
		this.$f.type.value = img.dataset.type.replace("image/", "")
		this.$f.size.value = (img.dataset.size/1000).toFixed(1)+" kB"
		this.$f.width.value = img.naturalWidth
		this.$f.height.value = img.naturalHeight
	}
}
