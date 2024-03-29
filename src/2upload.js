let unique = 1

function is_untitled(name) {
	return !name || /^(\w{8}-\w{4}-\w{4}-\w{4}-\w{12}|image)\.\w{3,4}$/.test(name)
}

class UploaderImage {
	constructor() {
		this.img = new Image()
		this.blob = null
		
		this.canvas = null
		
		this.task = null
		this.source = null
		this.width = null
		this.format = null
		this.quality = null
		Object.seal(this)
	}
	// todo: use FinalizationRegistry to detect leaks?
	free() {
		this.blob = null
		if (this.img.src) {
			this.img.src = ""
			URL.revokeObjectURL(this.img.src)
		}
		this.canvas = null
		this.source = null
	}
	blob_to_img() {
		console.log('to img', this.blob)
		if (this.img.src)
			URL.revokeObjectURL(this.img.src)
		this.img.src = this.blob ? URL.createObjectURL(this.blob) : ""
		if (this.blob)
			return this.img.decode()
	}
	// doesn't set this.blob
	canvas_to_blob(task) {
		console.log('to blob')
		return new Promise((y,n)=>{
			this.canvas.toBlob(blob=>{
				if (this.task!==task)
					n()
				else {
					blob ? y(blob) : n()
				}
			}, this.format, this.quality)
		})
	}
	source_to_canvas() {
		console.log('to canvas')
		let {naturalWidth:w, naturalHeight:h} = this.source.img
		let dw = this.width || w
		let dh = Math.round(dw * h / w)
		
		if (!this.canvas)
			this.canvas = document.createElement('canvas')
		this.canvas.width = dw
		this.canvas.height = dh
		let c2d = this.canvas.getContext('2d')
		// todo: option to resize in 2 steps?
		c2d.imageSmoothingEnabled = true
		let src = this.source.img
		if (c2d.imageSmoothingQuality) {
			c2d.imageSmoothingQuality = "high"
		} else if (this.width/w < .34) {
			// do it in 2 steps
			let n = document.createElement('canvas')
			n.width = dw*2
			n.height = dh*2
			let c = n.getContext('2d')
			c.imageSmoothingEnabled = false
			c.drawImage(this.source.img, 0, 0, dw*2, dh*2)
			src = n
		}
		c2d.drawImage(src, 0, 0, dw, dh)
	}
	cancel() {
		this.task = null
	}
	async update(source, width, format, quality) {
		console.log('update', source, width, format, quality)
		if (this.task)
			return
		let task = this.task = unique++
		
		try {
			switch (true) {
			default:
				return false
			case source !== this.source:
				this.free()
				this.source = source
				if (!this.source)
					return false
			case width !== this.width:
				this.width = width
				this.blob = null
				this.source_to_canvas()
			case quality !== this.quality:
			case format !== this.format:
				this.quality = quality
				this.format = format
				this.blob = null
				this.blob = await this.canvas_to_blob(task)
				await this.blob_to_img()
				if (task!==this.task)
					throw undefined
				return true
			}
		} finally {
			this.task = null
		}
	}
}

class Uploader {
	mode_state(state) {
		this.$f.mode.setAttribute('aria-selected', state)
		this.$f.dataset.page = state ? 'resize' : 'fields'
	}
	edit_state(state) {
		this.editing = state
		this.$f.dataset.editing = state
		if (state) {
			this.update()
		} else {
			this.back()
		}
	}
	constructor(f) {
		this.$f = f
		this.in = new UploaderImage()
		this.out = new UploaderImage()
		this.showing = null
		this.editing = false
		
		this.$f.onsubmit = ev=>{
			ev.preventDefault()
			if (ev.submitter.name=='scale')
				return
			alert('sent')
		}
		
		this.$f.edit.onchange = ev=>{
			this.edit_state(ev.target.checked)
		}
		
		this.$f.mode.onclick = ev=>{
			let state = ev.currentTarget.getAttribute('aria-selected')=='true'
			state = !state
			this.mode_state(state)
		}
		// todo: if these change faster than we can encode the img
		// that's REALLY bad, we need to ratelimit this
		this.$f.quality.onchange = ev=>{
			this.update()
		}
		this.$f.scale.onchange = ev=>{
			this.update()
		}
		this.$f.browse.onchange = ev=>{
			let file = ev.currentTarget.files[0]
			ev.currentTarget.value = ""
			if (file)
				this.got_upload(file)
		}
		this.$f.cancel.onclick = ev=>{
			this.out.cancel()
			this.in.free()
			this.out.free()
			this.$f.dataset.page = 'browse'
		}
	}
	show_out() {
		this.showing = this.out
		this.show_details(this.out)
	}
	back() {
		this.showing = this.in
		this.show_details(this.in)
	}
	async update() {
		if (!this.editing)
			return
		let source = this.in
		let width = +this.$f.scale.value
		let quality = +this.$f.quality.value/100
		let format = quality ? 'image/jpeg' : 'image/png'
		await this.out.update(source, width, format, quality)
		if (this.out.img.complete) {
			this.show_out()
		} else {
			this.out.img.addEventListener('load', ev=>{
				this.show_out()
			}, {once:true})
		}
	}
	async got_upload(file, name=file.name) {
		this.in.blob = file
		await this.in.blob_to_img()
		// reset the form
		this.mode_state(false)
		this.$f.name.value = name
		this.$f.hash.value = null
		let w = this.in.img.naturalWidth
		this.$f.scale.value = this.$f.scale.max = w
		if (this.in.blob.type=='image/jpeg')
			this.$f.quality.value = 70
		else
			this.$f.quality.value = 0
		this.$f.edit.checked = false
		this.edit_state(false)
	}
	
	show_details(t) {
		if (this.showing !== t)
			return
		
		if (t.img !== this.$image_box.firstChild)
			this.$image_box.replaceChildren(t.img)
		
		let size = t.blob.size
		if (size < 100e3) { // 0-100kb (green - yellow)
			size = (size) / (100e3)
			this.$color.style.backgroundColor = "rgb("+(size*255)+",255,0)"
		} else if (size < 2e6) { // 100kb - 2mb (yellow-red)
			size = (size-100e3) / (2e6-100e3)
			this.$color.style.backgroundColor = "rgb(255,"+((1-size)*255)+",0)"
		} else { // > 2mb (too large)
			this.$color.style.backgroundColor = "magenta"
		}
		
		this.$f.type.value = t.blob.type.replace("image/", "").toUpperCase()
		this.$f.size.value = (t.blob.size/1000).toFixed(0)
		this.$f.width.value = t.img.naturalWidth
		this.$f.height.value = t.img.naturalHeight
	}
	// cannot be destroyed. oops?
	init() {
		let es = document.createElement('span')
		function pick_name(transfer, cb) {
			let html = transfer.types.indexOf('text/html')
			if (html>=0) {
				transfer.items[html].getAsString(string=>{
					let m = / (aria-label|title|alt|src)="([^<"]+?)"/.exec(string)
					console.log(string, m)
					if (m) {
						es.innerHTML = m[2]
						string = es.textContent
						es.textContent = ""
					}
					cb(string)
				})
				return
			}
			let text = transfer.types.indexOf('text/plain')
			if (text>=0) {
				transfer.items[text].getAsString(string=>{
					cb(string)
				})
				return
			}
			cb()
		}
		
		document.addEventListener('paste', ev=>{
			let data = ev.clipboardData
			// get image
			let file = data && data.files[0]
			if (file && file.type.startsWith("image/")) {
				pick_name(data, (name=file.name)=>{
					this.got_upload(file, name)
				})
			}
		})
		document.addEventListener('dragover', ev=>{
			if (ev.dataTransfer.types.includes("Files")) {
				ev.preventDefault()
				ev.dataTransfer.dropEffect = 'copy'
			}
		})
		document.addEventListener('drop', ev=>{
			if (ev.target instanceof HTMLTextAreaElement)
				return
			let file = ev.dataTransfer.files[0]
			if (file) {
				ev.preventDefault()
				if (/^image\//.test(file.type))
					this.got_upload(file)
			}
		})
	}
}

// problem: flickering on ios?
// seems like it immediately blanks the image when src is updated
// rather than waiting til the new image is ready...

window.GeneratorFunction = function* () {}.constructor
window.Generator = GeneratorFunction.prototype

Generator.prototype.run = function(ok=console.info, err=e=>{ throw e }) {
	let step, main = data=>{
		step = defer => [data,step]=[defer,main] 
		try {
			let r = this.next(data)
			if (r.done) [data,step]=[r.value,ok]
		} catch (e) { [data,step]=[e,err] }
		step(data)
	}
	main()
	step(x=>step(x))
	return this
}

// sub-task factory - canvas encoder
function* encode_canvas(STEP, canvas, format, quality) {
	let blob = yield canvas.toBlob(STEP, format, quality)
	
	let ok = false, img = document.createElement('img')
	try {
		img.src = URL.createObjectURL(blob)
		console.log('created object url')
		yield img.onload = STEP
		ok = true
		return img
	} finally {
		if (!ok) {
			console.log('revoked object url')
			URL.revokeObjectURL(img.src)
		}
	}
}

/*let canvas = document.createElement('canvas')
canvas.width=500
canvas.height=300

// task factory - encode `canvas` as jpeg
function* encode_test() {
	let STEP = yield
	let img = yield* encode_canvas(STEP, canvas, 'image/jpeg', 0.4)
	console.info("finished", img)
	document.body.append(img)
}

let task = encode_test().run()
task.return() // cancel before it finishes

canvas.getContext('2d').fillRect(10, 50, 100, 100)
task = encode_test().run()
*/
