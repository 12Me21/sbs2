'use strict'

const TTSSystem = {
	speakUtterance(u) {
		return new Promise((yay, nay) => {
			u.onend = e=>(e.charIndex < e.target.length) ? nay(e) : yay()
			u.onerror = e=>nay(e)
			
			speechSynthesis.speak(u)
		})
	},
	
	playSound(s) {
		return new Promise((yay, nay) => {
			let se = s.elem
			
			se.currentTime = 0
			se.volume = ('number'==typeof s.volume) ? s.volume : 1.0
			
			let removeListeners = ()=>{ se.onpause = se.onerror = null }
			
			se.onpause = e=>removeListeners((se.currentTime < se.duration) ? nay(e) : yay())
			se.onerror = e=>removeListeners(nay(e))
			
			se.play()
		})
	},
	
	speakMessage(message, merged = false) {
		let tree = Markup.langs.parse(message.text, message.values.m)
		
		let msg
		if (!merged) {
			let author = message.Author
			let memorable_name = author.bridge ? (author.nickname || message.values.b) : author.username
			msg = `${memorable_name} says\n`
		}
		
		this.speakScript(this.renderSpeechScript(tree, { msg }))
	},
	
	queue: [],
	current: null,
	async speakScript(utter) {
		if (this.queue.push(utter)-1) return
		
		try {
			while (this.queue.length) {
				for (let u of this.queue[0]) {
					this.current = u
					if (u instanceof SpeechSynthesisUtterance) await this.speakUtterance(u)
					else if (u.elem instanceof HTMLAudioElement) await this.playSound(u)
				}
				this.current = null
				this.queue.shift()
			}
		} catch { return }
	},
	
	placeholderSound: null,
	
	synthParams: {
		voice: null,
		volume: 1,
		pitch: 1,
		rate: 1.25,
	},
	
	// creates a list of smaller utterances and media to play in sequence
	renderSpeechScript(tree, opts = {}) {
		opts.msg ||= ""
		opts.volume ||= this.synthParams.volume
		opts.pitch ||= this.synthParams.pitch
		opts.rate ||= this.synthParams.rate
		opts.utter ||= []
		opts.media ||= {}
		
		let clamp01 = x=>Math.max(0, Math.min(x, 1))
		
		let sound = url=>{
			if (!url)
				return
			finalizeChunk()
			let u = { volume: clamp01(opts.volume) }
			if (url instanceof HTMLAudioElement)
				u.elem = url
			else
				u.elem = opts.media[url] ||= new Audio(url)
			u.elem.loop = false
			opts.utter.push(u)
			return u
		}
		
		let renderWithAltParams = (elem, {volume = 1, pitch = 1, rate = 1})=>{
			let prev = [ opts.volume, opts.pitch, opts.rate ]
			opts.volume *= volume; opts.pitch *= pitch; opts.rate *= rate
			finalizeChunk()
			this.renderSpeechScript(elem, opts)
			finalizeChunk()
			;[ opts.volume, opts.pitch, opts.rate ] = prev
		}
		
		// pushes utterance onto the end of the speech queue.
		let finalizeChunk = ()=>{
			opts.msg = opts.msg.trim()
			if (!opts.msg.length)
				return
			
			let u = new SpeechSynthesisUtterance(opts.msg)
			u.voice = this.synthParams.voice
			u.volume = clamp01(opts.volume)
			// i'm just going to remove the clamp here and assume the browser handles that
			u.pitch = opts.pitch
			u.rate = opts.rate
			
			opts.utter.push(u)
			opts.msg = ""
		}
		
		// goofy way to do things
		function simplifyUrl(s) {
			if (s.includes("://qcs.s")) return "qcs"
			if (s.includes("cdn.discordapp.com/")) return "discord"
			if (s.includes(" ") && !s.includes(".")) return false // silly fake link heuristics
			if (s.includes(" ") && s.includes(".") && s.indexOf(" ") < s.indexOf(".")) return false
			if (s.startsWith('#')) return `anchor "${s.substring(1)}"`
			else try { return new URL(s).hostname.replace("www.", "") }
			catch { return "invalid URL" }
		}
		
		for (let elem of tree.content) {
			if ('string'==typeof elem) {
				if (elem.length > 2500)
					opts.msg += "(message too long)"
				else
					opts.msg += elem
			} else switch (elem.type) {
				case 'italic': {
					this.renderSpeechScript(elem, opts)
					// renderWithAltParams(elem, { rate: 0.75 })
				} break;case 'bold': {
					this.renderSpeechScript(elem, opts)
					// renderWithAltParams(elem, { pitch: 0.75 })
				} break;case 'strikethrough': {
					renderWithAltParams(elem, { rate: 1.25, volume: 0.75 })
				} break;case 'underline': {
					this.renderSpeechScript(elem, opts)
					// renderWithAltParams(elem, { pitch: 0.75, rate: 0.75 })
				} break;case 'video': {
					opts.msg += `\nvideo from ${simplifyUrl(elem.args.url)}\n`
				} break;case 'youtube': {
					opts.msg += "\nyoutube video\n"
				} break;case 'link': {
					// depending on if they're labeled or unlabeled,
					// i treat these as either inline or block respectively.
					// inline being normal space pause, block being sentence break.
					if (elem.content) {
						this.renderSpeechScript(elem, opts)
						opts.msg += " (link)"
					} else {
						opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${simplifyUrl(elem.args.url)}\n`
					}
				} break;case 'simple_link': {
					let url = simplifyUrl(elem.args.url)
					if (!url) opts.msg += ` ${elem.args.url} (fake link)`
					else opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${url}\n`
				} break;case 'image': { // pretty safe bet that all images are block elements
					opts.msg += (elem.args.alt ? `\n${elem.args.alt} (image)` : `\nimage from ${simplifyUrl(elem.args.url)}`) + "\n"
				} break;case 'audio': {
					sound(elem.args.url)
					// todo: time limite for audio?
				} break;case 'code': {
					opts.msg += "\ncode block"
					if (elem.args.lang && elem.args.lang != 'sb') // sign of the times...
						opts.msg += ` written in ${elem.args.lang}`
					opts.msg += "\n"
				} break;case 'icode': {
					opts.msg += elem.args.text
				} break;case 'spoiler': {
					opts.msg += "\nspoiler"
					if (elem.args.label)
						opts.msg += ` for ${elem.args.label}`
					opts.msg += "\n"
				} break;case 'heading': {
					renderWithAltParams(elem, { rate: 0.75, volume: 1.25 })
				} break;case 'subscript': case 'superscript': {
					renderWithAltParams(elem, { volume: 0.75 })
				} break;case 'quote': {
					opts.msg += "\nquote"
					if (elem.args.cite)
						opts.msg += ` from ${elem.args.cite}`
					opts.msg += "\n"
					this.renderSpeechScript(elem, opts)
					opts.msg += "\n(end quote)\n"
				} break;case 'ruby': {
					this.renderSpeechScript(elem, opts)
					if (elem.args.text)
						opts.msg += ` (${elem.args.text})`
				} break;case 'bg':case 'key':case 'list':case 'anchor': {
					this.renderSpeechScript(elem, opts)
				} break;case 'list_item': {
					this.renderSpeechScript(elem, opts)
					opts.msg += "\n"
				} break;case 'align': {
					opts.msg += "\n"
					this.renderSpeechScript(elem, opts)
					opts.msg += "\n"
				} break;case 'table_cell': {
					this.renderSpeechScript(elem, opts)
					opts.msg += "; "
				} break;case 'divider': {
					opts.msg += "\n"
				} break;case 'table': {
					let headers = elem.content[0]
					headers = headers.content[0].args.header ? headers : false
					if (!headers) opts.msg += "\ntable\n"
					else {
						opts.msg += "\ntable with headers: "
						this.renderSpeechScript(headers, opts)
						opts.msg += "\n"
					}
				} break;default: {
					if (elem.content)
						this.renderSpeechScript(elem, opts)
					else {
						// store loaded copy of placeholderSound for replaying later
						this.placeholderSound = sound(this.placeholderSound).elem
						console.log(`TTS renderer ignored ${elem.type}`)
					}
				}
			}
		}
		
		// if we're root elem, we probably have unfinalized stuff.
		// finalize it and return the utterance list.
		if (tree.type == 'ROOT') {
			finalizeChunk()
			if (!opts.utter.length) {
				opts.msg += 'nothing'
				finalizeChunk()
			}
			return opts.utter
		}
	},
	
	cancel() {
		// clear out queue
		this.queue = []
		
		// cancel current thing
		speechSynthesis.cancel()
		if (this.current && this.current.elem instanceof HTMLAudioElement)
			this.current.elem.pause()
		this.current = null
	}
}

Settings.add({
	name: 'tts_notify', label: "TTS Notify", type: 'select',
	options: ['no', 'everyone else', 'yes'],
})
Settings.add({
	name: 'tts_volume', label: "TTS Volume", type: 'range',
	range: [0.0, 1.0],
	default: 0.5,
	step: "0.05", //making this a string to /potentially/ bypass floating point
	notches: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], // 🥴
	update(value, type) {
		TTSSystem.synthParams.volume = value
		if ('change'==type) {
			TTSSystem.cancel()
			if (TTSSystem.placeholderSound)
				TTSSystem.speakMessage({text:"{#uwu",values:{m:'12y'}}, true)
			else
				TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
		}
	}
})
Settings.add({
	name: 'tts_speed', label: "TTS Speed", type: 'range',
	range: [0.5, 5], // (heard range may be narrower)
	step: "0.05",
	default: 1,
	notches: [1],
	update(value, type) {
		TTSSystem.synthParams.rate = value
		if ('change'==type) {
			TTSSystem.cancel()
			TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
		}
	},
})
Settings.add({
	name: 'tts_pitch', label: "TTS Pitch", type: 'range',
	range: [0, 2],
	step: "0.05",
	default: 1,
	notches: [1],
	update(value, type) {
		TTSSystem.synthParams.pitch = value
		if ('change'==type) {
			TTSSystem.cancel()
			TTSSystem.speakMessage({text:"example message",values:{m:'plaintext'}}, true)
		}
	},
})
