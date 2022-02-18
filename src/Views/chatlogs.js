with (View) (()=>{ "use strict"; {
	
	addView('chatlogs', {
		redirect: (id, query)=>{
			let q = {r: true}
			// we do it this way so the ORDER is preserved :D
			for (let key in query) {
				if (key=='t')
					q.s = query.t // name changed
				else if (key=='pid')
					q.pid = query.pid
				else if (key=='uid')
					q.uid = query.uid
			}
			return ['comments', null, q]
		},
		//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
		// show page name etc.
	})
	
}})()
