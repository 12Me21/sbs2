'use strict'

let TTSSystem = {}

function speakUtterance(u) {
	return new Promise((yay, nay) => {
		u.addEventListener('end', e=>(e.charIndex < e.target.length) ? nay(e) : yay())
		u.addEventListener('error', e=>nay(e))
		speechSynthesis.speak(u)
	})
}

function lastOfMetaUtterance(mu) {
	let last = mu[mu.length - 1]
	if (last instanceof SpeechSynthesisUtterance) {
		return new Promise((yay, nay) => {
			last.addEventListener('end', e=>(e.charIndex < e.target.length) ? nay(e) : yay())
			last.addEventListener('error', e=>nay(e))
		})
	} else if (last instanceof HTMLAudioElement) {
		return new Promise((yay, nay) => {
			let removeListeners
			
			let c_ended = e=>yay(removeListeners())
			let c_error = e=>nay(e,removeListeners())
			
			last.addEventListener('ended', c_ended)
			last.addEventListener('', c_error)
			last.addEventListener('error', c_error)
			
			removeListeners = ()=>{
				last.removeEventListener('ended', c_ended)
				last.removeEventListener('error', c_error)
			}
		})
	}
}

function loadSound(path) {
	let s = new Audio(path)
	s.loop = false; s.load()
	return s
}

function playSound(s) {
	return new Promise((yay, nay) => {
		let removeListeners
		
		let c_ended = e=>yay(removeListeners())
		let c_error = e=>nay(e,removeListeners())
		let c_loadeddata = e=>{console.log(s.readyState); return ((s.readyState >= HTMLMediaElement) && s.play())}
		
		s.addEventListener('ended', c_ended)
		s.addEventListener('error', c_error)
		
		removeListeners = ()=>{
			s.removeEventListener('ended', c_ended)
			s.removeEventListener('error', c_error)
			s.removeEventListener('loadeddata', c_loadeddata)
		}
		
		if (s.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA && !(s.currentTime > 0)) {
			s.addEventListener('loadeddata', c_loadeddata)
		} else {
			// TODO: play a placeholder sound if sound too long (>25s?)
			s.currentTime = 0; s.play()
		}
	})
}

// TODO: - get rid of gross blob of global garbage
//       - use custom events with "metautterances" to make things simpler

// breadcrumbs:
// message_part 👽 ./src/draw.js:163
//-> convert_lang 👽 ./markup2/helpers.js:47
//->-> Markup_Langs 👽 ./markup2/langs.js:40
//->-> etc: {} 👽 ignored, passed on to element

async function speakMessage(message, merged = false) {
	let tree = Markup.langs.parse(message.text, message.values.m)
	
	let author = message.Author
	let memorable_name = author.bridge ? (author.nickname || message.values.b) : author.username
	let msg = merged ? "" : `${memorable_name} says\n`
	
	speakScript(renderSpeechScript(tree, { msg }))
}

let otherSpeechScripts = []
async function speakScript(utter) {
	otherSpeechScripts.push(utter)
	if (otherSpeechScripts.length - 1)
		await lastOfMetaUtterance(otherSpeechScripts[otherSpeechScripts.length - 2])
	
	for (let u of utter) {
		if (u instanceof SpeechSynthesisUtterance) await speakUtterance(u)
		else if (u instanceof HTMLAudioElement) await playSound(u)
	}
	
	// sloppy
	otherSpeechScripts.shift()
}

// creates a list of smaller utterances and media to play in sequence
function renderSpeechScript(tree, opts = {}) {
	opts.msg ||= ""
	opts.pitch ||= 1//0.75
	opts.rate ||= 1.5
	opts.utter ||= []
	// if (opts.abridged == undefined) opts.abridged = true
	// Would it be nice to just have a way of reading the entire message without skipping over complex parts (full URLs, code blocks, tables)?
	
	function finalizePrev() {
		opts.msg = opts.msg.trim()
		if (!opts.msg.length) return
		let u = new SpeechSynthesisUtterance(opts.msg)
		u.pitch = opts.pitch; u.rate = opts.rate
		opts.utter.push(u); opts.msg = ""
	}
	
	// goofy way to do things
	function simplifyUrl(s) {
		return (s.includes("://qcs.s") && s.includes("/api/")) ? "qcs" : (new URL(s).hostname)
	}
	
	for (let elem of tree.content) {
		if ('string'==typeof elem) {
			if (elem.length > 2500) opts.msg += "(message too long)"
			else opts.msg += elem
		} else if ('object'==typeof elem) switch (elem.type) {
			case 'bold': {
				finalizePrev()
				renderSpeechScript(elem, {...opts, pitch: opts.pitch * 0.75})
			break }
			case 'italic': {
				finalizePrev()
				renderSpeechScript(elem, {...opts, rate: opts.rate * 0.9})
			break }
			case 'underline': {
				finalizePrev()
				renderSpeechScript(elem, {...opts, pitch: opts.pitch * 0.9, rate: opts.rate * 0.9})
			break }
			case 'video': {
				opts.msg += `\nvideo from ${simplifyUrl(elem.args.url)}\n`
			break }
			case 'youtube': {
				opts.msg += "\nyoutube video\n"
			break }
			case 'link': {
				// depending on if they're labeled or unlabeled,
				// i treat these as either inline or block respectively.
				// inline being normal space pause, block being sentence break.
				if (elem.content) {
					renderSpeechScript(elem, opts)
					opts.msg += " (link)"
				} else {
					opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${simplifyUrl(elem.args.url)}\n`
				}
			break }
			case 'simple_link': {
				opts.msg += elem.args.text ? ` ${elem.args.text} (link)` : `\nlink to ${simplifyUrl(elem.args.url)}\n`
			break }
			case 'image': { // pretty safe bet that all images are block elements
				opts.msg += "\n" + (elem.args.alt ? `${elem.args.alt} (image)` : `image from ${simplifyUrl(elem.args.url)}`) + "\n"
			break }
			case 'audio': {
				finalizePrev()
				opts.mediaCache ||= {}
				opts.utter.push(opts.mediaCache[elem.args.url] ||= loadSound(elem.args.url))
				// todo: time limite for audio?
			break }
			case 'code': {
				opts.msg += '\ncode block\n' // TODO: :/
			break }
			case 'icode': {
				opts.msg += elem.args.text
			break }
			case 'spoiler': {
				opts.msg += "\nspoiler"
				if (elem.args.label)
					opts.msg += ` for ${elem.args.label}`
				opts.msg += "\n"
			break }
			default: {
				if (elem.content)
					renderSpeechScript(elem, opts)
				else {
					const huh = "./resource/meow.wav"
					opts.mediaCache ||= {}
					if (opts.mediaCache[huh] == undefined)
						opts.mediaCache[huh] = new Audio(huh)
					console.log(`TTS Ignored ${elem.type}...`)
				}
			break }
		}
	}
	finalizePrev()
	return opts.utter
}
