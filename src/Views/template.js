'use strict'

/**
 * `route_name'/`id'?`query'
 * @typedef {Object} Location
 * @property {string} type - Not known yet
 * @property {number|string} id - The ID of the location (usually a hash or number ID)
 * @property {Object} query - Key/Value params passed to the path
 * @property {unknown} fragment - I think this is the anchor?
 */

/**
 * Chain request
 * @typedef {Object} ChainRequest
 * @property {boolean} [quick] - Used to determine whether `Quick' or `Render' should be run. True=Quick, False=Render
 * @property {Object} [chain] - The API request parameters.
 */

// Naming convention is {Name}View.
class TemplateView extends BaseView {
	/**
	 * This is run when the page is initially loaded. This should be used for
	 * setup that should only be run once.
	 * (in the future, it may be deferred until the view is visited
	 * for the first time)
	 */
	Init() {
		// Fill me in.
	}

	/**
	 * This is used every time the View is loaded in order to fetch an API request.
	 * @param {Location} location - The location
	 */
	Start({id, query}) {
		const return_quick = true
		// emacs doesn't know how to indent tertiary conditionals correctly? lol
		// sorry for this abysmal stuff....
		if (return_quick)
			return { quick: true }
		return {
			chain: {
				values: {},
				requests: [],
			},
			check: resp=>true
		}
	}

	/**
	 * This is run when the return value of `Start' has `quick' set to true instead
	 * of render.
	 * An API request is also not passed to ContentAPI. This is typically used in the
	 * case where you do not need an API request. (whether it is because of something
	 * already being cached or it does not require a request or anything similar)
	 */
	Quick() {
		// Fill me in
	}
	
	/**
	 * This is run after the API request that is triggered from `Init' is completed
	 * This should be used to update the HTML on the page.
	 * @param {Object} response - The response given back from the API declared by `Init'.
	 */
	Render(resp) {
		// Fill me in
	}

	/**
	 * When the View becomes visible. Triggered when initially viewing
	 * the View or when viewing the View again after being in a "hidden" state.
	 * (caused by being in another tab or having the window out of view)
	 */
	Visible() {
		// Fill me in
	}

	/**
	 * When loading a new view (in the case where one of the parameters passed to
	 * `Start' is changed), this method is ran in order to clean it up before rerendering
	 * onto the view again.
	 */
	Destroy() {
		// Fill me in
	}
}

TemplateView.template = HTML`
<view-root class='COL'>
   Hello, World!
</view-root>
`

View.register('template', TemplateView)
