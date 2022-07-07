'use strict';

function speakThing(msg, opts) {
	let u = new SpeechSynthesisUtterance(msg);
	u.pitch = opts.pitch; u.rate = opts.rate;
	return new Promise((yay, nay) => {
		// TOD: you can press it when it's already running and they'll overlap
		u.addEventListener('end', e => (e.charIndex < e.utterance.text.length) ? nay(e) : yay());
		u.addEventListener('error', e => nay(e));
		speechSynthesis.speak(u);
	});
}

function loadSound(path) {
	return new Promise((yay, nay) => {
		let s = new Audio(path);
		s.addEventListener('error', e => nay(e));
		s.addEventListener('canplaythrough', () => yay(s));
		s.loop = false;
		s.load();
	});
}

function playSound(s) {
	return new Promise((yay, nay) => {
		s.addEventListener('error', e => nay(e))
		s.addEventListener('ended', () => yay())
		s.play()
	})
}

let simplifyUrl = (s)=>(new URL(s).hostname)

// if it ever errors, it should always treat that as a cancel.
// if it recieves a cancel event, it should peace out.

// breadcrumbs:
// message_part 👽 ./src/draw.js:163
//-> convert_lang 👽 ./markup2/helpers.js:47
//->-> Markup_Langs 👽 ./markup2/langs.js:40
//->-> etc: {} 👽 ignored, passed on to element

async function speakMessage(message) {
	let tree = Markup.langs.parse(message.text, message.values.m)
	let opts = { pitch: 0.75, rate: 1.5 }
	speechSynthesis.cancel()
	await speakThing(`${message.Author.bridge ? message.Author.nickname : message.Author.username} says:`, opts)
	await speakTree(tree, opts)
}

async function speakTree(tree, opts = {}) {
	(opts.playing == undefined) && (opts.playing = true)
	opts.mediaCache ||= {}
	for (let elem of tree.content) {
		if (typeof elem == 'string') {
			await speakThing(elem, opts)
		} else if (typeof elem == 'object') switch (elem.type) {
			case 'bold': {
				let prev = opts.pitch
				opts.pitch *= 0.85
				speakTree(elem, opts)
				opts.pitch = prev
			} break
			case 'italic': {
				let prev = opts.rate
				opts.rate *= 0.85
				speakTree(elem, opts)
				opts.rate = prev
			} break
			case 'video': {
				await speakThing(`video from ${simplifyURL(elem.args.url)}`, opts)
			} break
			case 'youtube': {
				await speakThing("youtube video", opts)
			} break
			case 'link': {
				console.log(elem);
				if (elem.content) {
					speakTree(elem, opts) // 🥴
					await speakThing("(link)", opts)
				} else {
					let s = "";
					elem.args.text ? `${elem.args.text} (link)` : `link to ${simplifyUrl(elem.args.url)}`
					await speakThing(s, opts)
				}
			} break
			case 'simple_link': {
				console.log(elem);
				let s = elem.args.text ? `${elem.args.text} (link)` : `link to ${simplifyUrl(elem.args.url)}`
				await speakThing(s, opts)
			} break
			case 'image': {
				let s = elem.args.alt ? `${elem.args.alt} (image)` : `image from ${simplifyUrl(elem.args.url)}`
				await speakThing(s, opts)
			} break
			case 'audio': {
				await playSound(opts.mediaCache[elem.args.url] ||= await loadSound(elem.args.url))
			} break
			default: {
				if (elem.content)
					speakTree(elem, opts)
				else {
					const huh = "./resource/meow.wav";
					if (opts.mediaCache[huh] == undefined)
						opts.mediaCache[huh] = await loadSound(huh)
					await playSound(opts.mediaCache[huh])
					console.log(`Ignored ${elem.type}...`)
				}
			} break
		}
	}
}
