/**
* Proxy v1.0
* http://github.com/bemson/Proxy/
*
* Copyright 2010, Bemi Faison
* Licensed under the MIT License
* http://en.wikipedia.org/wiki/MIT_License#License_terms
**/

/**
* Creates an instance with methods scoped to another object.
*
* @param {Object} source The object to use as a scope for mapped methods.
* @param {Object} [scheme] Collection of methods and property-maps. Functions become methods of the instance. Property-maps are compiled for use by the instance method, gset().
**/
function Proxy(source,scheme) {
	// init vars
	var pxy = this, // alias self
		cfgs = {}, // information about configurable options
		Ary = Array, // shorthand Array constructor
		kinds = { // collection of types tested by this instance
			s: 'string', // live
			f: 'function',
			o: 'object',
			a: 'array'
		},
		feats = [ // captures features of this instance
			{}, // property names and permissions
			[] // method names
		],
		pm,kind,key,cfg; // loop vars
	// if not invoked with new, throw error
	if (!(pxy instanceof arguments.callee)) throw new Error('Proxy: missing new operator');
	// if no source is given, throw error
	if (source == null) throw new Error('Proxy: invalid source');
	// with each mapping...
	for (key in scheme) {
		// skip inherited properties
		if (!scheme.hasOwnProperty(key)) continue;
		// capture property-map
		pm = scheme[key];
		// capture kind of map
		kind = typeof pm;
		// if this is a function...
		if (kind === kinds.f) {
			// add scoped method to instance
			pxy[key] = function () {return pm.apply(source,arguments)};
			// capture method name
			feats[1].push(key);
		} else { // otherwise, when not a function...
			// define a configuration information object for this mapping
			cfg = {
				get: 0,
				set: 0
			};
			// if pm is an Array...
			if (kind === kinds.o && pm instanceof Ary) {
				// if this map's only element is another array...
				if (pm.length === 1 && pm[0] instanceof Ary) {
					// change value in scheme to it's nested value
					scheme[key] = pm[0];
					// flag that this config will have an array for a static value
					cfg.isAry = 1;
				} else { // otherwise, when the first element is not an array or more elements exist...
					// refine kind (so it's recognized as a mapping)
					kind = kinds.a;
					// if the array has no length, define full-access pm
					if (!pm.length) pm = scheme[key] = [key,1];
				}
			}
			// if this is an array (proxy map)...
			if (kind === kinds.a) {
				// capture types for get, check and set indice
				kind = [typeof pm[0],typeof pm[1],typeof pm[2]];
				// if get is a function or a valid string...
				if (kind[0] === kinds.f || (kind[0] === kinds.s && kind[0].length)) {
					// flag that this mapping gets
					cfg.get = 1;
					// define getter function or property based on kind
					cfg[kind[0] === kinds.f ? 'getter' : 'property'] = pm[0];
				}
				// if set is a function...
				if (kind[2] === kinds.f) {
					// flag that this mapping sets
					cfg.set = 1;
					// define setter
					cfg.setter = pm[2];
				}
				// if there is a second index...
				if (pm.length > 1) {
					// flag that this mapping sets (again)
					cfg.set = 1;
					// if the validator is a function or valid string...
					if (kind[1] === kinds.f || (kind[1] === kinds.s && kind[1].length)) {
						// define validator as type or function, based on kind
						cfg[kind[1] === kinds.f ? 'validator' : 'type'] = pm[1];
					} else { // otherwise, when validator is not recognized...
						// flag that all values are valid
						cfg.validAny = 1;
					}
				}
			} else { // otherwise, when not an array (or function)...
				// flag that this mapping gets
				cfg.get = 1;
				// flag that this is a static configuration
				cfg.static = 1;
				// capture static value
				cfg.staticValue = scheme[key];
			}
			// if this mapping gets or sets...
			if (cfg.get || cfg.set) {
				// capture code for this config, based on get/set states
				feats[0][key] = cfg.get - cfg.set;
				// add to cfgs
				cfgs[key] = cfg;
			}
		}
	}
	/**
	* Get or set a property.
	*
	* @param {String} alias The proxy alias to set or get.
	* @param {Object} [value]	The value to use when setting.
	*							When omitted, this method returns the value of the given alias.
	* @returns {Boolean|Object|Array}	When setting, it returns true when successful and false otherwise.
	*							When getting, it returns the property value or false when the value is not found.
	*							When no arguments are given, an object of available properties and accessor codes is returned.
	*							When alias references this instance, an array of method names.
	**/
	pxy.gset = function (alias) {
		// init vars
		var args = arguments, // alias arguments
			value = args[1], // capture value in arguments (if any)
			isSet = args.length > 1, // flag when attempting to set a property
			action = isSet ? 'set' : 'get', // indicates when setting the target property
			setArgs = [isSet ? value : null, alias, isSet ? 'v' : 'g', pxy], // args to send functions
			cfg = cfgs[alias], // alias the config for the requested property
			codeConst = function () {}; // constructor to clone codes

		// if no arguments were given...
		if (!args.length) {
			// prototype codes to constructor
			codeConst.prototype = feats[0];
			// return copy of codes
			return new codeConst();
		}

		// if this instance was given, return copy of method names
		if (alias === pxy) return feats[1].concat();

		// if a config exist for the target property...
		if (cfg) {
			// if the target action is available...
			if (cfg && cfg[action]) {
				// if static, return static value (clone arrays to protect indice)
				if (cfg.static) return cfg.isAry ? cfg.staticValue.concat() : cfg.staticValue;
				// if setting...
				if (isSet) {
					// (otherwise) if no validation is needed or the value validates...
					if (cfg.validAny || ((!cfg.type || typeof value === cfg.type) && (!cfg.validator || cfg.validator.apply(source,setArgs)))) {
						// if there is a setter or getter function, return result of invoking either function (setter has precedence)
						if ((cfg.setter || cfg.getter) && setArgs.splice(2,1,'s')) return (cfg.setter || cfg.getter).apply(source,setArgs);
						// (otherwise) set the configured property or given alias in the proxied object
						source[cfg.property || alias] = value;
						// flag success with setting the private property
						return !0;
					}
				} else { // otherwise, when getting...
					// if a function, return result of executing the function within the scope of the proxied object
					if (cfg.getter) return cfg.getter.apply(source,setArgs);
					// (otherwise) return value of property in source object
					return source[cfg.property];
				}
			} else { // otherwise, when the action is not available...
				// throw error for illegal action
				throw new Error('Proxy: "' + alias + '" has no ' + action + 'ter');
			}
		} else { // otherwise, when no config exist...
			// throw error for unmapped alias
			throw new Error('Proxy: "' + alias + '" is unmapped');
		}

		// return false if any valid action fails (this would occur when a validation routine fails)
		return !1;
	};
}
