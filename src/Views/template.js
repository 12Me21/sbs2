'use strict'

/**
 * `route_name'/`id'?`query'
 * @typedef {Object} Location
 * @property {string} type - Not known yet
 * @property {number|string} id - The ID of the location (usually a hash or number ID)
 * @property {Object} query - Key/Value params passed to the path
 * @property {unknown} fragment - I think this is the anchor?
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
		return {
			chain: {
				values: {},
				requests: [],
			},
			check: resp=>true
		}
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
	  * This is used before unloading the View in order to clean it up.
	  * (I believe a View will not actually fully delete all of the HTML if you
	  *  only change one of the properties passed to it, so it should be done even
	  *  if it's unnecessary? Best to consult with 12 on this one...)
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

