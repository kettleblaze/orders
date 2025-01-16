var preOrdersApp = (function () {
	'use strict';

	var DEV = false;

	// Store the references to globals in case someone tries to monkey patch these, causing the below
	// to de-opt (this occurs often when using popular extensions).
	var is_array = Array.isArray;
	var index_of = Array.prototype.indexOf;
	var array_from = Array.from;
	var define_property = Object.defineProperty;
	var get_descriptor = Object.getOwnPropertyDescriptor;
	var get_descriptors = Object.getOwnPropertyDescriptors;
	var object_prototype = Object.prototype;
	var array_prototype = Array.prototype;
	var get_prototype_of = Object.getPrototypeOf;

	// Adapted from https://github.com/then/is-promise/blob/master/index.js
	// Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE

	/**
	 * @template [T=any]
	 * @param {any} value
	 * @returns {value is PromiseLike<T>}
	 */
	function is_promise(value) {
		return typeof value?.then === 'function';
	}

	/** @param {Function} fn */
	function run(fn) {
		return fn();
	}

	/** @param {Array<() => void>} arr */
	function run_all(arr) {
		for (var i = 0; i < arr.length; i++) {
			arr[i]();
		}
	}

	const DERIVED = 1 << 1;
	const EFFECT = 1 << 2;
	const RENDER_EFFECT = 1 << 3;
	const BLOCK_EFFECT = 1 << 4;
	const BRANCH_EFFECT = 1 << 5;
	const ROOT_EFFECT = 1 << 6;
	const BOUNDARY_EFFECT = 1 << 7;
	const UNOWNED = 1 << 8;
	const DISCONNECTED = 1 << 9;
	const CLEAN = 1 << 10;
	const DIRTY = 1 << 11;
	const MAYBE_DIRTY = 1 << 12;
	const INERT = 1 << 13;
	const DESTROYED = 1 << 14;
	const EFFECT_RAN = 1 << 15;
	/** 'Transparent' effects do not create a transition boundary */
	const EFFECT_TRANSPARENT = 1 << 16;
	/** Svelte 4 legacy mode props need to be handled with deriveds and be recognized elsewhere, hence the dedicated flag */
	const LEGACY_DERIVED_PROP = 1 << 17;
	const HEAD_EFFECT = 1 << 19;
	const EFFECT_HAS_DERIVED = 1 << 20;

	const STATE_SYMBOL = Symbol('$state');
	const LEGACY_PROPS = Symbol('legacy props');
	const LOADING_ATTR_SYMBOL = Symbol('');

	/** @import { Equals } from '#client' */
	/** @type {Equals} */
	function equals(value) {
		return value === this.v;
	}

	/**
	 * @param {unknown} a
	 * @param {unknown} b
	 * @returns {boolean}
	 */
	function safe_not_equal(a, b) {
		return a != a
			? b == b
			: a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
	}

	/** @type {Equals} */
	function safe_equals(value) {
		return !safe_not_equal(value, this.v);
	}


	/**
	 * `%rune%` cannot be used inside an effect cleanup function
	 * @param {string} rune
	 * @returns {never}
	 */
	function effect_in_teardown(rune) {
		{
			throw new Error(`https://svelte.dev/e/effect_in_teardown`);
		}
	}

	/**
	 * Effect cannot be created inside a `$derived` value that was not itself created inside an effect
	 * @returns {never}
	 */
	function effect_in_unowned_derived() {
		{
			throw new Error(`https://svelte.dev/e/effect_in_unowned_derived`);
		}
	}

	/**
	 * `%rune%` can only be used inside an effect (e.g. during component initialisation)
	 * @param {string} rune
	 * @returns {never}
	 */
	function effect_orphan(rune) {
		{
			throw new Error(`https://svelte.dev/e/effect_orphan`);
		}
	}

	/**
	 * Maximum update depth exceeded. This can happen when a reactive block or effect repeatedly sets a new value. Svelte limits the number of nested updates to prevent infinite loops
	 * @returns {never}
	 */
	function effect_update_depth_exceeded() {
		{
			throw new Error(`https://svelte.dev/e/effect_update_depth_exceeded`);
		}
	}

	/**
	 * Cannot do `bind:%key%={undefined}` when `%key%` has a fallback value
	 * @param {string} key
	 * @returns {never}
	 */
	function props_invalid_value(key) {
		{
			throw new Error(`https://svelte.dev/e/props_invalid_value`);
		}
	}

	/**
	 * Property descriptors defined on `$state` objects must contain `value` and always be `enumerable`, `configurable` and `writable`.
	 * @returns {never}
	 */
	function state_descriptors_fixed() {
		{
			throw new Error(`https://svelte.dev/e/state_descriptors_fixed`);
		}
	}

	/**
	 * Cannot set prototype of `$state` object
	 * @returns {never}
	 */
	function state_prototype_fixed() {
		{
			throw new Error(`https://svelte.dev/e/state_prototype_fixed`);
		}
	}

	/**
	 * Reading state that was created inside the same derived is forbidden. Consider using `untrack` to read locally created state
	 * @returns {never}
	 */
	function state_unsafe_local_read() {
		{
			throw new Error(`https://svelte.dev/e/state_unsafe_local_read`);
		}
	}

	/**
	 * Updating state inside a derived or a template expression is forbidden. If the value should not be reactive, declare it without `$state`
	 * @returns {never}
	 */
	function state_unsafe_mutation() {
		{
			throw new Error(`https://svelte.dev/e/state_unsafe_mutation`);
		}
	}

	let legacy_mode_flag = false;
	let tracing_mode_flag = false;

	function enable_legacy_mode_flag() {
		legacy_mode_flag = true;
	}

	const EACH_ITEM_REACTIVE = 1;
	const EACH_INDEX_REACTIVE = 1 << 1;
	const EACH_ITEM_IMMUTABLE = 1 << 4;

	const PROPS_IS_IMMUTABLE = 1;
	const PROPS_IS_RUNES = 1 << 1;
	const PROPS_IS_UPDATED = 1 << 2;
	const PROPS_IS_BINDABLE = 1 << 3;
	const PROPS_IS_LAZY_INITIAL = 1 << 4;
	const TEMPLATE_USE_IMPORT_NODE = 1 << 1;

	const UNINITIALIZED = Symbol();

	/** @import { Derived, Effect, Reaction, Source, Value } from '#client' */

	/**
	 * @template V
	 * @param {V} v
	 * @param {Error | null} [stack]
	 * @returns {Source<V>}
	 */
	function source(v, stack) {
		/** @type {Value} */
		var signal = {
			f: 0, // TODO ideally we could skip this altogether, but it causes type errors
			v,
			reactions: null,
			equals,
			rv: 0,
			wv: 0
		};

		return signal;
	}

	/**
	 * @template V
	 * @param {V} initial_value
	 * @param {boolean} [immutable]
	 * @returns {Source<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function mutable_source(initial_value, immutable = false) {
		const s = source(initial_value);
		if (!immutable) {
			s.equals = safe_equals;
		}

		// bind the signal to the component context, in case we need to
		// track updates to trigger beforeUpdate/afterUpdate callbacks
		if (legacy_mode_flag && component_context !== null && component_context.l !== null) {
			(component_context.l.s ??= []).push(s);
		}

		return s;
	}

	/**
	 * @template V
	 * @param {Source<V>} source
	 * @param {V} value
	 * @returns {V}
	 */
	function set(source, value) {
		if (
			active_reaction !== null &&
			is_runes() &&
			(active_reaction.f & (DERIVED | BLOCK_EFFECT)) !== 0 &&
			// If the source was created locally within the current derived, then
			// we allow the mutation.
			(derived_sources === null || !derived_sources.includes(source))
		) {
			state_unsafe_mutation();
		}

		return internal_set(source, value);
	}

	/**
	 * @template V
	 * @param {Source<V>} source
	 * @param {V} value
	 * @returns {V}
	 */
	function internal_set(source, value) {
		if (!source.equals(value)) {
			source.v;
			source.v = value;
			source.wv = increment_write_version();

			mark_reactions(source, DIRTY);

			// If the current signal is running for the first time, it won't have any
			// reactions as we only allocate and assign the reactions after the signal
			// has fully executed. So in the case of ensuring it registers the reaction
			// properly for itself, we need to ensure the current effect actually gets
			// scheduled. i.e: `$effect(() => x++)`
			if (
				is_runes() &&
				active_effect !== null &&
				(active_effect.f & CLEAN) !== 0 &&
				(active_effect.f & BRANCH_EFFECT) === 0
			) {
				if (new_deps !== null && new_deps.includes(source)) {
					set_signal_status(active_effect, DIRTY);
					schedule_effect(active_effect);
				} else {
					if (untracked_writes === null) {
						set_untracked_writes([source]);
					} else {
						untracked_writes.push(source);
					}
				}
			}
		}

		return value;
	}

	/**
	 * @param {Value} signal
	 * @param {number} status should be DIRTY or MAYBE_DIRTY
	 * @returns {void}
	 */
	function mark_reactions(signal, status) {
		var reactions = signal.reactions;
		if (reactions === null) return;

		var runes = is_runes();
		var length = reactions.length;

		for (var i = 0; i < length; i++) {
			var reaction = reactions[i];
			var flags = reaction.f;

			// Skip any effects that are already dirty
			if ((flags & DIRTY) !== 0) continue;

			// In legacy mode, skip the current effect to prevent infinite loops
			if (!runes && reaction === active_effect) continue;

			set_signal_status(reaction, status);

			// If the signal a) was previously clean or b) is an unowned derived, then mark it
			if ((flags & (CLEAN | UNOWNED)) !== 0) {
				if ((flags & DERIVED) !== 0) {
					mark_reactions(/** @type {Derived} */ (reaction), MAYBE_DIRTY);
				} else {
					schedule_effect(/** @type {Effect} */ (reaction));
				}
			}
		}
	}

	/** @import { TemplateNode } from '#client' */


	/**
	 * Use this variable to guard everything related to hydration code so it can be treeshaken out
	 * if the user doesn't use the `hydrate` method and these code paths are therefore not needed.
	 */
	let hydrating = false;

	/** @param {TemplateNode} node */
	function reset(node) {
		return;
	}

	/** @import { ProxyMetadata, ProxyStateObject, Source } from '#client' */

	/**
	 * @template T
	 * @param {T} value
	 * @param {ProxyMetadata | null} [parent]
	 * @param {Source<T>} [prev] dev mode only
	 * @returns {T}
	 */
	function proxy(value, parent = null, prev) {
		// if non-proxyable, or is already a proxy, return `value`
		if (typeof value !== 'object' || value === null || STATE_SYMBOL in value) {
			return value;
		}

		const prototype = get_prototype_of(value);

		if (prototype !== object_prototype && prototype !== array_prototype) {
			return value;
		}

		/** @type {Map<any, Source<any>>} */
		var sources = new Map();
		var is_proxied_array = is_array(value);
		var version = source(0);

		if (is_proxied_array) {
			// We need to create the length source eagerly to ensure that
			// mutations to the array are properly synced with our proxy
			sources.set('length', source(/** @type {any[]} */ (value).length));
		}

		/** @type {ProxyMetadata} */
		var metadata;

		return new Proxy(/** @type {any} */ (value), {
			defineProperty(_, prop, descriptor) {
				if (
					!('value' in descriptor) ||
					descriptor.configurable === false ||
					descriptor.enumerable === false ||
					descriptor.writable === false
				) {
					// we disallow non-basic descriptors, because unless they are applied to the
					// target object — which we avoid, so that state can be forked — we will run
					// afoul of the various invariants
					// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/getOwnPropertyDescriptor#invariants
					state_descriptors_fixed();
				}

				var s = sources.get(prop);

				if (s === undefined) {
					s = source(descriptor.value);
					sources.set(prop, s);
				} else {
					set(s, proxy(descriptor.value, metadata));
				}

				return true;
			},

			deleteProperty(target, prop) {
				var s = sources.get(prop);

				if (s === undefined) {
					if (prop in target) {
						sources.set(prop, source(UNINITIALIZED));
					}
				} else {
					// When working with arrays, we need to also ensure we update the length when removing
					// an indexed property
					if (is_proxied_array && typeof prop === 'string') {
						var ls = /** @type {Source<number>} */ (sources.get('length'));
						var n = Number(prop);

						if (Number.isInteger(n) && n < ls.v) {
							set(ls, n);
						}
					}
					set(s, UNINITIALIZED);
					update_version(version);
				}

				return true;
			},

			get(target, prop, receiver) {

				if (prop === STATE_SYMBOL) {
					return value;
				}

				var s = sources.get(prop);
				var exists = prop in target;

				// create a source, but only if it's an own property and not a prototype property
				if (s === undefined && (!exists || get_descriptor(target, prop)?.writable)) {
					s = source(proxy(exists ? target[prop] : UNINITIALIZED, metadata));
					sources.set(prop, s);
				}

				if (s !== undefined) {
					var v = get(s);

					return v === UNINITIALIZED ? undefined : v;
				}

				return Reflect.get(target, prop, receiver);
			},

			getOwnPropertyDescriptor(target, prop) {
				var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

				if (descriptor && 'value' in descriptor) {
					var s = sources.get(prop);
					if (s) descriptor.value = get(s);
				} else if (descriptor === undefined) {
					var source = sources.get(prop);
					var value = source?.v;

					if (source !== undefined && value !== UNINITIALIZED) {
						return {
							enumerable: true,
							configurable: true,
							value,
							writable: true
						};
					}
				}

				return descriptor;
			},

			has(target, prop) {

				if (prop === STATE_SYMBOL) {
					return true;
				}

				var s = sources.get(prop);
				var has = (s !== undefined && s.v !== UNINITIALIZED) || Reflect.has(target, prop);

				if (
					s !== undefined ||
					(active_effect !== null && (!has || get_descriptor(target, prop)?.writable))
				) {
					if (s === undefined) {
						s = source(has ? proxy(target[prop], metadata) : UNINITIALIZED);
						sources.set(prop, s);
					}

					var value = get(s);
					if (value === UNINITIALIZED) {
						return false;
					}
				}

				return has;
			},

			set(target, prop, value, receiver) {
				var s = sources.get(prop);
				var has = prop in target;

				// variable.length = value -> clear all signals with index >= value
				if (is_proxied_array && prop === 'length') {
					for (var i = value; i < /** @type {Source<number>} */ (s).v; i += 1) {
						var other_s = sources.get(i + '');
						if (other_s !== undefined) {
							set(other_s, UNINITIALIZED);
						} else if (i in target) {
							// If the item exists in the original, we need to create a uninitialized source,
							// else a later read of the property would result in a source being created with
							// the value of the original item at that index.
							other_s = source(UNINITIALIZED);
							sources.set(i + '', other_s);
						}
					}
				}

				// If we haven't yet created a source for this property, we need to ensure
				// we do so otherwise if we read it later, then the write won't be tracked and
				// the heuristics of effects will be different vs if we had read the proxied
				// object property before writing to that property.
				if (s === undefined) {
					if (!has || get_descriptor(target, prop)?.writable) {
						s = source(undefined);
						set(s, proxy(value, metadata));
						sources.set(prop, s);
					}
				} else {
					has = s.v !== UNINITIALIZED;
					set(s, proxy(value, metadata));
				}

				var descriptor = Reflect.getOwnPropertyDescriptor(target, prop);

				// Set the new value before updating any signals so that any listeners get the new value
				if (descriptor?.set) {
					descriptor.set.call(receiver, value);
				}

				if (!has) {
					// If we have mutated an array directly, we might need to
					// signal that length has also changed. Do it before updating metadata
					// to ensure that iterating over the array as a result of a metadata update
					// will not cause the length to be out of sync.
					if (is_proxied_array && typeof prop === 'string') {
						var ls = /** @type {Source<number>} */ (sources.get('length'));
						var n = Number(prop);

						if (Number.isInteger(n) && n >= ls.v) {
							set(ls, n + 1);
						}
					}

					update_version(version);
				}

				return true;
			},

			ownKeys(target) {
				get(version);

				var own_keys = Reflect.ownKeys(target).filter((key) => {
					var source = sources.get(key);
					return source === undefined || source.v !== UNINITIALIZED;
				});

				for (var [key, source] of sources) {
					if (source.v !== UNINITIALIZED && !(key in target)) {
						own_keys.push(key);
					}
				}

				return own_keys;
			},

			setPrototypeOf() {
				state_prototype_fixed();
			}
		});
	}

	/**
	 * @param {Source<number>} signal
	 * @param {1 | -1} [d]
	 */
	function update_version(signal, d = 1) {
		set(signal, signal.v + d);
	}

	/** @import { TemplateNode } from '#client' */

	// export these for reference in the compiled code, making global name deduplication unnecessary
	/** @type {Window} */
	var $window;

	/** @type {() => Node | null} */
	var first_child_getter;
	/** @type {() => Node | null} */
	var next_sibling_getter;

	/**
	 * Initialize these lazily to avoid issues when using the runtime in a server context
	 * where these globals are not available while avoiding a separate server entry point
	 */
	function init_operations() {
		if ($window !== undefined) {
			return;
		}

		$window = window;

		var element_prototype = Element.prototype;
		var node_prototype = Node.prototype;

		// @ts-ignore
		first_child_getter = get_descriptor(node_prototype, 'firstChild').get;
		// @ts-ignore
		next_sibling_getter = get_descriptor(node_prototype, 'nextSibling').get;

		// the following assignments improve perf of lookups on DOM nodes
		// @ts-expect-error
		element_prototype.__click = undefined;
		// @ts-expect-error
		element_prototype.__className = '';
		// @ts-expect-error
		element_prototype.__attributes = null;
		// @ts-expect-error
		element_prototype.__styles = null;
		// @ts-expect-error
		element_prototype.__e = undefined;

		// @ts-expect-error
		Text.prototype.__t = undefined;
	}

	/**
	 * @param {string} value
	 * @returns {Text}
	 */
	function create_text(value = '') {
		return document.createTextNode(value);
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 * @returns {Node | null}
	 */
	/*@__NO_SIDE_EFFECTS__*/
	function get_first_child(node) {
		return first_child_getter.call(node);
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 * @returns {Node | null}
	 */
	/*@__NO_SIDE_EFFECTS__*/
	function get_next_sibling(node) {
		return next_sibling_getter.call(node);
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @template {Node} N
	 * @param {N} node
	 * @param {boolean} is_text
	 * @returns {Node | null}
	 */
	function child(node, is_text) {
		{
			return get_first_child(node);
		}
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {DocumentFragment | TemplateNode[]} fragment
	 * @param {boolean} is_text
	 * @returns {Node | null}
	 */
	function first_child(fragment, is_text) {
		{
			// when not hydrating, `fragment` is a `DocumentFragment` (the result of calling `open_frag`)
			var first = /** @type {DocumentFragment} */ (get_first_child(/** @type {Node} */ (fragment)));

			// TODO prevent user comments with the empty string when preserveComments is true
			if (first instanceof Comment && first.data === '') return get_next_sibling(first);

			return first;
		}
	}

	/**
	 * Don't mark this as side-effect-free, hydration needs to walk all nodes
	 * @param {TemplateNode} node
	 * @param {number} count
	 * @param {boolean} is_text
	 * @returns {Node | null}
	 */
	function sibling(node, count = 1, is_text = false) {
		let next_sibling = node;

		while (count--) {
			next_sibling = /** @type {TemplateNode} */ (get_next_sibling(next_sibling));
		}

		{
			return next_sibling;
		}
	}

	/**
	 * @template {Node} N
	 * @param {N} node
	 * @returns {void}
	 */
	function clear_text_content(node) {
		node.textContent = '';
	}

	/** @import { Derived, Effect } from '#client' */

	/**
	 * @template V
	 * @param {() => V} fn
	 * @returns {Derived<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function derived(fn) {
		var flags = DERIVED | DIRTY;

		if (active_effect === null) {
			flags |= UNOWNED;
		} else {
			// Since deriveds are evaluated lazily, any effects created inside them are
			// created too late to ensure that the parent effect is added to the tree
			active_effect.f |= EFFECT_HAS_DERIVED;
		}

		var parent_derived =
			active_reaction !== null && (active_reaction.f & DERIVED) !== 0
				? /** @type {Derived} */ (active_reaction)
				: null;

		/** @type {Derived<V>} */
		const signal = {
			children: null,
			ctx: component_context,
			deps: null,
			equals,
			f: flags,
			fn,
			reactions: null,
			rv: 0,
			v: /** @type {V} */ (null),
			wv: 0,
			parent: parent_derived ?? active_effect
		};

		if (parent_derived !== null) {
			(parent_derived.children ??= []).push(signal);
		}

		return signal;
	}

	/**
	 * @template V
	 * @param {() => V} fn
	 * @returns {Derived<V>}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function derived_safe_equal(fn) {
		const signal = derived(fn);
		signal.equals = safe_equals;
		return signal;
	}

	/**
	 * @param {Derived} derived
	 * @returns {void}
	 */
	function destroy_derived_children(derived) {
		var children = derived.children;

		if (children !== null) {
			derived.children = null;

			for (var i = 0; i < children.length; i += 1) {
				var child = children[i];
				if ((child.f & DERIVED) !== 0) {
					destroy_derived(/** @type {Derived} */ (child));
				} else {
					destroy_effect(/** @type {Effect} */ (child));
				}
			}
		}
	}

	/**
	 * @param {Derived} derived
	 * @returns {Effect | null}
	 */
	function get_derived_parent_effect(derived) {
		var parent = derived.parent;
		while (parent !== null) {
			if ((parent.f & DERIVED) === 0) {
				return /** @type {Effect} */ (parent);
			}
			parent = parent.parent;
		}
		return null;
	}

	/**
	 * @template T
	 * @param {Derived} derived
	 * @returns {T}
	 */
	function execute_derived(derived) {
		var value;
		var prev_active_effect = active_effect;

		set_active_effect(get_derived_parent_effect(derived));

		{
			try {
				destroy_derived_children(derived);
				value = update_reaction(derived);
			} finally {
				set_active_effect(prev_active_effect);
			}
		}

		return value;
	}

	/**
	 * @param {Derived} derived
	 * @returns {void}
	 */
	function update_derived(derived) {
		var value = execute_derived(derived);
		var status =
			(skip_reaction || (derived.f & UNOWNED) !== 0) && derived.deps !== null ? MAYBE_DIRTY : CLEAN;

		set_signal_status(derived, status);

		if (!derived.equals(value)) {
			derived.v = value;
			derived.wv = increment_write_version();
		}
	}

	/**
	 * @param {Derived} derived
	 * @returns {void}
	 */
	function destroy_derived(derived) {
		destroy_derived_children(derived);
		remove_reactions(derived, 0);
		set_signal_status(derived, DESTROYED);

		derived.v = derived.children = derived.deps = derived.ctx = derived.reactions = null;
	}

	/** @import { ComponentContext, ComponentContextLegacy, Derived, Effect, TemplateNode, TransitionManager } from '#client' */

	/**
	 * @param {'$effect' | '$effect.pre' | '$inspect'} rune
	 */
	function validate_effect(rune) {
		if (active_effect === null && active_reaction === null) {
			effect_orphan();
		}

		if (active_reaction !== null && (active_reaction.f & UNOWNED) !== 0) {
			effect_in_unowned_derived();
		}

		if (is_destroying_effect) {
			effect_in_teardown();
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {Effect} parent_effect
	 */
	function push_effect(effect, parent_effect) {
		var parent_last = parent_effect.last;
		if (parent_last === null) {
			parent_effect.last = parent_effect.first = effect;
		} else {
			parent_last.next = effect;
			effect.prev = parent_last;
			parent_effect.last = effect;
		}
	}

	/**
	 * @param {number} type
	 * @param {null | (() => void | (() => void))} fn
	 * @param {boolean} sync
	 * @param {boolean} push
	 * @returns {Effect}
	 */
	function create_effect(type, fn, sync, push = true) {
		var is_root = (type & ROOT_EFFECT) !== 0;
		var parent_effect = active_effect;

		/** @type {Effect} */
		var effect = {
			ctx: component_context,
			deps: null,
			deriveds: null,
			nodes_start: null,
			nodes_end: null,
			f: type | DIRTY,
			first: null,
			fn,
			last: null,
			next: null,
			parent: is_root ? null : parent_effect,
			prev: null,
			teardown: null,
			transitions: null,
			wv: 0
		};

		if (sync) {
			var previously_flushing_effect = is_flushing_effect;

			try {
				set_is_flushing_effect(true);
				update_effect(effect);
				effect.f |= EFFECT_RAN;
			} catch (e) {
				destroy_effect(effect);
				throw e;
			} finally {
				set_is_flushing_effect(previously_flushing_effect);
			}
		} else if (fn !== null) {
			schedule_effect(effect);
		}

		// if an effect has no dependencies, no DOM and no teardown function,
		// don't bother adding it to the effect tree
		var inert =
			sync &&
			effect.deps === null &&
			effect.first === null &&
			effect.nodes_start === null &&
			effect.teardown === null &&
			(effect.f & EFFECT_HAS_DERIVED) === 0;

		if (!inert && !is_root && push) {
			if (parent_effect !== null) {
				push_effect(effect, parent_effect);
			}

			// if we're in a derived, add the effect there too
			if (active_reaction !== null && (active_reaction.f & DERIVED) !== 0) {
				var derived = /** @type {Derived} */ (active_reaction);
				(derived.children ??= []).push(effect);
			}
		}

		return effect;
	}

	/**
	 * Internal representation of `$effect(...)`
	 * @param {() => void | (() => void)} fn
	 */
	function user_effect(fn) {
		validate_effect();

		// Non-nested `$effect(...)` in a component should be deferred
		// until the component is mounted
		var defer =
			active_effect !== null &&
			(active_effect.f & BRANCH_EFFECT) !== 0 &&
			component_context !== null &&
			!component_context.m;

		if (defer) {
			var context = /** @type {ComponentContext} */ (component_context);
			(context.e ??= []).push({
				fn,
				effect: active_effect,
				reaction: active_reaction
			});
		} else {
			var signal = effect(fn);
			return signal;
		}
	}

	/**
	 * Internal representation of `$effect.pre(...)`
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function user_pre_effect(fn) {
		validate_effect();
		return render_effect(fn);
	}

	/**
	 * An effect root whose children can transition out
	 * @param {() => void} fn
	 * @returns {(options?: { outro?: boolean }) => Promise<void>}
	 */
	function component_root(fn) {
		const effect = create_effect(ROOT_EFFECT, fn, true);

		return (options = {}) => {
			return new Promise((fulfil) => {
				if (options.outro) {
					pause_effect(effect, () => {
						destroy_effect(effect);
						fulfil(undefined);
					});
				} else {
					destroy_effect(effect);
					fulfil(undefined);
				}
			});
		};
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function effect(fn) {
		return create_effect(EFFECT, fn, false);
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function render_effect(fn) {
		return create_effect(RENDER_EFFECT, fn, true);
	}

	/**
	 * @param {() => void | (() => void)} fn
	 * @returns {Effect}
	 */
	function template_effect(fn) {
		return block(fn);
	}

	/**
	 * @param {(() => void)} fn
	 * @param {number} flags
	 */
	function block(fn, flags = 0) {
		return create_effect(RENDER_EFFECT | BLOCK_EFFECT | flags, fn, true);
	}

	/**
	 * @param {(() => void)} fn
	 * @param {boolean} [push]
	 */
	function branch(fn, push = true) {
		return create_effect(RENDER_EFFECT | BRANCH_EFFECT, fn, true, push);
	}

	/**
	 * @param {Effect} effect
	 */
	function execute_effect_teardown(effect) {
		var teardown = effect.teardown;
		if (teardown !== null) {
			const previously_destroying_effect = is_destroying_effect;
			const previous_reaction = active_reaction;
			set_is_destroying_effect(true);
			set_active_reaction(null);
			try {
				teardown.call(null);
			} finally {
				set_is_destroying_effect(previously_destroying_effect);
				set_active_reaction(previous_reaction);
			}
		}
	}

	/**
	 * @param {Effect} signal
	 * @returns {void}
	 */
	function destroy_effect_deriveds(signal) {
		var deriveds = signal.deriveds;

		if (deriveds !== null) {
			signal.deriveds = null;

			for (var i = 0; i < deriveds.length; i += 1) {
				destroy_derived(deriveds[i]);
			}
		}
	}

	/**
	 * @param {Effect} signal
	 * @param {boolean} remove_dom
	 * @returns {void}
	 */
	function destroy_effect_children(signal, remove_dom = false) {
		var effect = signal.first;
		signal.first = signal.last = null;

		while (effect !== null) {
			var next = effect.next;
			destroy_effect(effect, remove_dom);
			effect = next;
		}
	}

	/**
	 * @param {Effect} signal
	 * @returns {void}
	 */
	function destroy_block_effect_children(signal) {
		var effect = signal.first;

		while (effect !== null) {
			var next = effect.next;
			if ((effect.f & BRANCH_EFFECT) === 0) {
				destroy_effect(effect);
			}
			effect = next;
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {boolean} [remove_dom]
	 * @returns {void}
	 */
	function destroy_effect(effect, remove_dom = true) {
		var removed = false;

		if ((remove_dom || (effect.f & HEAD_EFFECT) !== 0) && effect.nodes_start !== null) {
			/** @type {TemplateNode | null} */
			var node = effect.nodes_start;
			var end = effect.nodes_end;

			while (node !== null) {
				/** @type {TemplateNode | null} */
				var next = node === end ? null : /** @type {TemplateNode} */ (get_next_sibling(node));

				node.remove();
				node = next;
			}

			removed = true;
		}

		destroy_effect_children(effect, remove_dom && !removed);
		destroy_effect_deriveds(effect);
		remove_reactions(effect, 0);
		set_signal_status(effect, DESTROYED);

		var transitions = effect.transitions;

		if (transitions !== null) {
			for (const transition of transitions) {
				transition.stop();
			}
		}

		execute_effect_teardown(effect);

		var parent = effect.parent;

		// If the parent doesn't have any children, then skip this work altogether
		if (parent !== null && parent.first !== null) {
			unlink_effect(effect);
		}

		// `first` and `child` are nulled out in destroy_effect_children
		// we don't null out `parent` so that error propagation can work correctly
		effect.next =
			effect.prev =
			effect.teardown =
			effect.ctx =
			effect.deps =
			effect.fn =
			effect.nodes_start =
			effect.nodes_end =
				null;
	}

	/**
	 * Detach an effect from the effect tree, freeing up memory and
	 * reducing the amount of work that happens on subsequent traversals
	 * @param {Effect} effect
	 */
	function unlink_effect(effect) {
		var parent = effect.parent;
		var prev = effect.prev;
		var next = effect.next;

		if (prev !== null) prev.next = next;
		if (next !== null) next.prev = prev;

		if (parent !== null) {
			if (parent.first === effect) parent.first = next;
			if (parent.last === effect) parent.last = prev;
		}
	}

	/**
	 * When a block effect is removed, we don't immediately destroy it or yank it
	 * out of the DOM, because it might have transitions. Instead, we 'pause' it.
	 * It stays around (in memory, and in the DOM) until outro transitions have
	 * completed, and if the state change is reversed then we _resume_ it.
	 * A paused effect does not update, and the DOM subtree becomes inert.
	 * @param {Effect} effect
	 * @param {() => void} [callback]
	 */
	function pause_effect(effect, callback) {
		/** @type {TransitionManager[]} */
		var transitions = [];

		pause_children(effect, transitions, true);

		run_out_transitions(transitions, () => {
			destroy_effect(effect);
			if (callback) callback();
		});
	}

	/**
	 * @param {TransitionManager[]} transitions
	 * @param {() => void} fn
	 */
	function run_out_transitions(transitions, fn) {
		var remaining = transitions.length;
		if (remaining > 0) {
			var check = () => --remaining || fn();
			for (var transition of transitions) {
				transition.out(check);
			}
		} else {
			fn();
		}
	}

	/**
	 * @param {Effect} effect
	 * @param {TransitionManager[]} transitions
	 * @param {boolean} local
	 */
	function pause_children(effect, transitions, local) {
		if ((effect.f & INERT) !== 0) return;
		effect.f ^= INERT;

		if (effect.transitions !== null) {
			for (const transition of effect.transitions) {
				if (transition.is_global || local) {
					transitions.push(transition);
				}
			}
		}

		var child = effect.first;

		while (child !== null) {
			var sibling = child.next;
			var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
			// TODO we don't need to call pause_children recursively with a linked list in place
			// it's slightly more involved though as we have to account for `transparent` changing
			// through the tree.
			pause_children(child, transitions, transparent ? local : false);
			child = sibling;
		}
	}

	/**
	 * The opposite of `pause_effect`. We call this if (for example)
	 * `x` becomes falsy then truthy: `{#if x}...{/if}`
	 * @param {Effect} effect
	 */
	function resume_effect(effect) {
		resume_children(effect, true);
	}

	/**
	 * @param {Effect} effect
	 * @param {boolean} local
	 */
	function resume_children(effect, local) {
		if ((effect.f & INERT) === 0) return;

		// If a dependency of this effect changed while it was paused,
		// apply the change now
		if (check_dirtiness(effect)) {
			update_effect(effect);
		}

		// Ensure we toggle the flag after possibly updating the effect so that
		// each block logic can correctly operate on inert items
		effect.f ^= INERT;

		var child = effect.first;

		while (child !== null) {
			var sibling = child.next;
			var transparent = (child.f & EFFECT_TRANSPARENT) !== 0 || (child.f & BRANCH_EFFECT) !== 0;
			// TODO we don't need to call resume_children recursively with a linked list in place
			// it's slightly more involved though as we have to account for `transparent` changing
			// through the tree.
			resume_children(child, transparent ? local : false);
			child = sibling;
		}

		if (effect.transitions !== null) {
			for (const transition of effect.transitions) {
				if (transition.is_global || local) {
					transition.in();
				}
			}
		}
	}

	let is_micro_task_queued$1 = false;

	/** @type {Array<() => void>} */
	let current_queued_micro_tasks = [];

	function process_micro_tasks() {
		is_micro_task_queued$1 = false;
		const tasks = current_queued_micro_tasks.slice();
		current_queued_micro_tasks = [];
		run_all(tasks);
	}

	/**
	 * @param {() => void} fn
	 */
	function queue_micro_task(fn) {
		if (!is_micro_task_queued$1) {
			is_micro_task_queued$1 = true;
			queueMicrotask(process_micro_tasks);
		}
		current_queued_micro_tasks.push(fn);
	}

	/**
	 * Synchronously run any queued tasks.
	 */
	function flush_tasks() {
		if (is_micro_task_queued$1) {
			process_micro_tasks();
		}
	}

	/** @import { ComponentContext, Derived, Effect, Reaction, Signal, Source, Value } from '#client' */

	const FLUSH_MICROTASK = 0;
	const FLUSH_SYNC = 1;
	let is_throwing_error = false;

	// Used for controlling the flush of effects.
	let scheduler_mode = FLUSH_MICROTASK;
	// Used for handling scheduling
	let is_micro_task_queued = false;

	/** @type {Effect | null} */
	let last_scheduled_effect = null;

	let is_flushing_effect = false;
	let is_destroying_effect = false;

	/** @param {boolean} value */
	function set_is_flushing_effect(value) {
		is_flushing_effect = value;
	}

	/** @param {boolean} value */
	function set_is_destroying_effect(value) {
		is_destroying_effect = value;
	}

	// Handle effect queues

	/** @type {Effect[]} */
	let queued_root_effects = [];

	let flush_count = 0;
	/** @type {Effect[]} Stack of effects, dev only */
	let dev_effect_stack = [];
	// Handle signal reactivity tree dependencies and reactions

	/** @type {null | Reaction} */
	let active_reaction = null;

	/** @param {null | Reaction} reaction */
	function set_active_reaction(reaction) {
		active_reaction = reaction;
	}

	/** @type {null | Effect} */
	let active_effect = null;

	/** @param {null | Effect} effect */
	function set_active_effect(effect) {
		active_effect = effect;
	}

	/**
	 * When sources are created within a derived, we record them so that we can safely allow
	 * local mutations to these sources without the side-effect error being invoked unnecessarily.
	 * @type {null | Source[]}
	 */
	let derived_sources = null;

	/**
	 * The dependencies of the reaction that is currently being executed. In many cases,
	 * the dependencies are unchanged between runs, and so this will be `null` unless
	 * and until a new dependency is accessed — we track this via `skipped_deps`
	 * @type {null | Value[]}
	 */
	let new_deps = null;

	let skipped_deps = 0;

	/**
	 * Tracks writes that the effect it's executed in doesn't listen to yet,
	 * so that the dependency can be added to the effect later on if it then reads it
	 * @type {null | Source[]}
	 */
	let untracked_writes = null;

	/** @param {null | Source[]} value */
	function set_untracked_writes(value) {
		untracked_writes = value;
	}

	/**
	 * @type {number} Used by sources and deriveds for handling updates.
	 * Version starts from 1 so that unowned deriveds differentiate between a created effect and a run one for tracing
	 **/
	let write_version = 1;

	/** @type {number} Used to version each read of a source of derived to avoid duplicating depedencies inside a reaction */
	let read_version = 0;

	// If we are working with a get() chain that has no active container,
	// to prevent memory leaks, we skip adding the reaction.
	let skip_reaction = false;

	// Handling runtime component context
	/** @type {ComponentContext | null} */
	let component_context = null;

	/** @param {ComponentContext | null} context */
	function set_component_context(context) {
		component_context = context;
	}

	function increment_write_version() {
		return ++write_version;
	}

	/** @returns {boolean} */
	function is_runes() {
		return !legacy_mode_flag || (component_context !== null && component_context.l === null);
	}

	/**
	 * Determines whether a derived or effect is dirty.
	 * If it is MAYBE_DIRTY, will set the status to CLEAN
	 * @param {Reaction} reaction
	 * @returns {boolean}
	 */
	function check_dirtiness(reaction) {
		var flags = reaction.f;

		if ((flags & DIRTY) !== 0) {
			return true;
		}

		if ((flags & MAYBE_DIRTY) !== 0) {
			var dependencies = reaction.deps;
			var is_unowned = (flags & UNOWNED) !== 0;

			if (dependencies !== null) {
				var i;
				var dependency;
				var is_disconnected = (flags & DISCONNECTED) !== 0;
				var is_unowned_connected = is_unowned && active_effect !== null && !skip_reaction;
				var length = dependencies.length;

				// If we are working with a disconnected or an unowned signal that is now connected (due to an active effect)
				// then we need to re-connect the reaction to the dependency
				if (is_disconnected || is_unowned_connected) {
					for (i = 0; i < length; i++) {
						dependency = dependencies[i];

						// We always re-add all reactions (even duplicates) if the derived was
						// previously disconnected
						if (is_disconnected || !dependency?.reactions?.includes(reaction)) {
							(dependency.reactions ??= []).push(reaction);
						}
					}

					if (is_disconnected) {
						reaction.f ^= DISCONNECTED;
					}
				}

				for (i = 0; i < length; i++) {
					dependency = dependencies[i];

					if (check_dirtiness(/** @type {Derived} */ (dependency))) {
						update_derived(/** @type {Derived} */ (dependency));
					}

					if (dependency.wv > reaction.wv) {
						return true;
					}
				}
			}

			// Unowned signals should never be marked as clean unless they
			// are used within an active_effect without skip_reaction
			if (!is_unowned || (active_effect !== null && !skip_reaction)) {
				set_signal_status(reaction, CLEAN);
			}
		}

		return false;
	}

	/**
	 * @param {unknown} error
	 * @param {Effect} effect
	 */
	function propagate_error(error, effect) {
		/** @type {Effect | null} */
		var current = effect;

		while (current !== null) {
			if ((current.f & BOUNDARY_EFFECT) !== 0) {
				try {
					// @ts-expect-error
					current.fn(error);
					return;
				} catch {
					// Remove boundary flag from effect
					current.f ^= BOUNDARY_EFFECT;
				}
			}

			current = current.parent;
		}

		is_throwing_error = false;
		throw error;
	}

	/**
	 * @param {Effect} effect
	 */
	function should_rethrow_error(effect) {
		return (
			(effect.f & DESTROYED) === 0 &&
			(effect.parent === null || (effect.parent.f & BOUNDARY_EFFECT) === 0)
		);
	}

	/**
	 * @param {unknown} error
	 * @param {Effect} effect
	 * @param {Effect | null} previous_effect
	 * @param {ComponentContext | null} component_context
	 */
	function handle_error(error, effect, previous_effect, component_context) {
		if (is_throwing_error) {
			if (previous_effect === null) {
				is_throwing_error = false;
			}

			if (should_rethrow_error(effect)) {
				throw error;
			}

			return;
		}

		if (previous_effect !== null) {
			is_throwing_error = true;
		}

		{
			propagate_error(error, effect);
			return;
		}
	}

	/**
	 * @template V
	 * @param {Reaction} reaction
	 * @returns {V}
	 */
	function update_reaction(reaction) {
		var previous_deps = new_deps;
		var previous_skipped_deps = skipped_deps;
		var previous_untracked_writes = untracked_writes;
		var previous_reaction = active_reaction;
		var previous_skip_reaction = skip_reaction;
		var prev_derived_sources = derived_sources;
		var previous_component_context = component_context;
		var flags = reaction.f;

		new_deps = /** @type {null | Value[]} */ (null);
		skipped_deps = 0;
		untracked_writes = null;
		active_reaction = (flags & (BRANCH_EFFECT | ROOT_EFFECT)) === 0 ? reaction : null;
		skip_reaction = !is_flushing_effect && (flags & UNOWNED) !== 0;
		derived_sources = null;
		component_context = reaction.ctx;
		read_version++;

		try {
			var result = /** @type {Function} */ (0, reaction.fn)();
			var deps = reaction.deps;

			if (new_deps !== null) {
				var i;

				remove_reactions(reaction, skipped_deps);

				if (deps !== null && skipped_deps > 0) {
					deps.length = skipped_deps + new_deps.length;
					for (i = 0; i < new_deps.length; i++) {
						deps[skipped_deps + i] = new_deps[i];
					}
				} else {
					reaction.deps = deps = new_deps;
				}

				if (!skip_reaction) {
					for (i = skipped_deps; i < deps.length; i++) {
						(deps[i].reactions ??= []).push(reaction);
					}
				}
			} else if (deps !== null && skipped_deps < deps.length) {
				remove_reactions(reaction, skipped_deps);
				deps.length = skipped_deps;
			}

			// If we are returning to an previous reaction then
			// we need to increment the read version to ensure that
			// any dependencies in this reaction aren't marked with
			// the same version
			if (previous_reaction !== null) {
				read_version++;
			}

			return result;
		} finally {
			new_deps = previous_deps;
			skipped_deps = previous_skipped_deps;
			untracked_writes = previous_untracked_writes;
			active_reaction = previous_reaction;
			skip_reaction = previous_skip_reaction;
			derived_sources = prev_derived_sources;
			component_context = previous_component_context;
		}
	}

	/**
	 * @template V
	 * @param {Reaction} signal
	 * @param {Value<V>} dependency
	 * @returns {void}
	 */
	function remove_reaction(signal, dependency) {
		let reactions = dependency.reactions;
		if (reactions !== null) {
			var index = index_of.call(reactions, signal);
			if (index !== -1) {
				var new_length = reactions.length - 1;
				if (new_length === 0) {
					reactions = dependency.reactions = null;
				} else {
					// Swap with last element and then remove.
					reactions[index] = reactions[new_length];
					reactions.pop();
				}
			}
		}
		// If the derived has no reactions, then we can disconnect it from the graph,
		// allowing it to either reconnect in the future, or be GC'd by the VM.
		if (
			reactions === null &&
			(dependency.f & DERIVED) !== 0 &&
			// Destroying a child effect while updating a parent effect can cause a dependency to appear
			// to be unused, when in fact it is used by the currently-updating parent. Checking `new_deps`
			// allows us to skip the expensive work of disconnecting and immediately reconnecting it
			(new_deps === null || !new_deps.includes(dependency))
		) {
			set_signal_status(dependency, MAYBE_DIRTY);
			// If we are working with a derived that is owned by an effect, then mark it as being
			// disconnected.
			if ((dependency.f & (UNOWNED | DISCONNECTED)) === 0) {
				dependency.f ^= DISCONNECTED;
			}
			remove_reactions(/** @type {Derived} **/ (dependency), 0);
		}
	}

	/**
	 * @param {Reaction} signal
	 * @param {number} start_index
	 * @returns {void}
	 */
	function remove_reactions(signal, start_index) {
		var dependencies = signal.deps;
		if (dependencies === null) return;

		for (var i = start_index; i < dependencies.length; i++) {
			remove_reaction(signal, dependencies[i]);
		}
	}

	/**
	 * @param {Effect} effect
	 * @returns {void}
	 */
	function update_effect(effect) {
		var flags = effect.f;

		if ((flags & DESTROYED) !== 0) {
			return;
		}

		set_signal_status(effect, CLEAN);

		var previous_effect = active_effect;
		var previous_component_context = component_context;

		active_effect = effect;

		try {
			if ((flags & BLOCK_EFFECT) !== 0) {
				destroy_block_effect_children(effect);
			} else {
				destroy_effect_children(effect);
			}
			destroy_effect_deriveds(effect);

			execute_effect_teardown(effect);
			var teardown = update_reaction(effect);
			effect.teardown = typeof teardown === 'function' ? teardown : null;
			effect.wv = write_version;

			var deps = effect.deps;

			// In DEV, we need to handle a case where $inspect.trace() might
			// incorrectly state a source dependency has not changed when it has.
			// That's beacuse that source was changed by the same effect, causing
			// the versions to match. We can avoid this by incrementing the version
			var dep; if (DEV && tracing_mode_flag && (effect.f & DIRTY) !== 0 && deps !== null) ;

			if (DEV) ;
		} catch (error) {
			handle_error(error, effect, previous_effect, previous_component_context || effect.ctx);
		} finally {
			active_effect = previous_effect;
		}
	}

	function infinite_loop_guard() {
		if (flush_count > 1000) {
			flush_count = 0;
			try {
				effect_update_depth_exceeded();
			} catch (error) {
				// Try and handle the error so it can be caught at a boundary, that's
				// if there's an effect available from when it was last scheduled
				if (last_scheduled_effect !== null) {
					{
						handle_error(error, last_scheduled_effect, null);
					}
				} else {
					throw error;
				}
			}
		}
		flush_count++;
	}

	/**
	 * @param {Array<Effect>} root_effects
	 * @returns {void}
	 */
	function flush_queued_root_effects(root_effects) {
		var length = root_effects.length;
		if (length === 0) {
			return;
		}
		infinite_loop_guard();

		var previously_flushing_effect = is_flushing_effect;
		is_flushing_effect = true;

		try {
			for (var i = 0; i < length; i++) {
				var effect = root_effects[i];

				if ((effect.f & CLEAN) === 0) {
					effect.f ^= CLEAN;
				}

				/** @type {Effect[]} */
				var collected_effects = [];

				process_effects(effect, collected_effects);
				flush_queued_effects(collected_effects);
			}
		} finally {
			is_flushing_effect = previously_flushing_effect;
		}
	}

	/**
	 * @param {Array<Effect>} effects
	 * @returns {void}
	 */
	function flush_queued_effects(effects) {
		var length = effects.length;
		if (length === 0) return;

		for (var i = 0; i < length; i++) {
			var effect = effects[i];

			if ((effect.f & (DESTROYED | INERT)) === 0) {
				try {
					if (check_dirtiness(effect)) {
						update_effect(effect);

						// Effects with no dependencies or teardown do not get added to the effect tree.
						// Deferred effects (e.g. `$effect(...)`) _are_ added to the tree because we
						// don't know if we need to keep them until they are executed. Doing the check
						// here (rather than in `update_effect`) allows us to skip the work for
						// immediate effects.
						if (effect.deps === null && effect.first === null && effect.nodes_start === null) {
							if (effect.teardown === null) {
								// remove this effect from the graph
								unlink_effect(effect);
							} else {
								// keep the effect in the graph, but free up some memory
								effect.fn = null;
							}
						}
					}
				} catch (error) {
					handle_error(error, effect, null, effect.ctx);
				}
			}
		}
	}

	function process_deferred() {
		is_micro_task_queued = false;
		if (flush_count > 1001) {
			return;
		}
		const previous_queued_root_effects = queued_root_effects;
		queued_root_effects = [];
		flush_queued_root_effects(previous_queued_root_effects);

		if (!is_micro_task_queued) {
			flush_count = 0;
			last_scheduled_effect = null;
		}
	}

	/**
	 * @param {Effect} signal
	 * @returns {void}
	 */
	function schedule_effect(signal) {
		if (scheduler_mode === FLUSH_MICROTASK) {
			if (!is_micro_task_queued) {
				is_micro_task_queued = true;
				queueMicrotask(process_deferred);
			}
		}

		last_scheduled_effect = signal;

		var effect = signal;

		while (effect.parent !== null) {
			effect = effect.parent;
			var flags = effect.f;

			if ((flags & (ROOT_EFFECT | BRANCH_EFFECT)) !== 0) {
				if ((flags & CLEAN) === 0) return;
				effect.f ^= CLEAN;
			}
		}

		queued_root_effects.push(effect);
	}

	/**
	 *
	 * This function both runs render effects and collects user effects in topological order
	 * from the starting effect passed in. Effects will be collected when they match the filtered
	 * bitwise flag passed in only. The collected effects array will be populated with all the user
	 * effects to be flushed.
	 *
	 * @param {Effect} effect
	 * @param {Effect[]} collected_effects
	 * @returns {void}
	 */
	function process_effects(effect, collected_effects) {
		var current_effect = effect.first;
		var effects = [];

		main_loop: while (current_effect !== null) {
			var flags = current_effect.f;
			var is_branch = (flags & BRANCH_EFFECT) !== 0;
			var is_skippable_branch = is_branch && (flags & CLEAN) !== 0;
			var sibling = current_effect.next;

			if (!is_skippable_branch && (flags & INERT) === 0) {
				if ((flags & RENDER_EFFECT) !== 0) {
					if (is_branch) {
						current_effect.f ^= CLEAN;
					} else {
						try {
							if (check_dirtiness(current_effect)) {
								update_effect(current_effect);
							}
						} catch (error) {
							handle_error(error, current_effect, null, current_effect.ctx);
						}
					}

					var child = current_effect.first;

					if (child !== null) {
						current_effect = child;
						continue;
					}
				} else if ((flags & EFFECT) !== 0) {
					effects.push(current_effect);
				}
			}

			if (sibling === null) {
				let parent = current_effect.parent;

				while (parent !== null) {
					if (effect === parent) {
						break main_loop;
					}
					var parent_sibling = parent.next;
					if (parent_sibling !== null) {
						current_effect = parent_sibling;
						continue main_loop;
					}
					parent = parent.parent;
				}
			}

			current_effect = sibling;
		}

		// We might be dealing with many effects here, far more than can be spread into
		// an array push call (callstack overflow). So let's deal with each effect in a loop.
		for (var i = 0; i < effects.length; i++) {
			child = effects[i];
			collected_effects.push(child);
			process_effects(child, collected_effects);
		}
	}

	/**
	 * Internal version of `flushSync` with the option to not flush previous effects.
	 * Returns the result of the passed function, if given.
	 * @param {() => any} [fn]
	 * @returns {any}
	 */
	function flush_sync(fn) {
		var previous_scheduler_mode = scheduler_mode;
		var previous_queued_root_effects = queued_root_effects;

		try {
			infinite_loop_guard();

			/** @type {Effect[]} */
			const root_effects = [];

			scheduler_mode = FLUSH_SYNC;
			queued_root_effects = root_effects;
			is_micro_task_queued = false;

			flush_queued_root_effects(previous_queued_root_effects);

			var result = fn?.();

			flush_tasks();
			if (queued_root_effects.length > 0 || root_effects.length > 0) {
				flush_sync();
			}

			flush_count = 0;
			last_scheduled_effect = null;
			if (DEV) ;

			return result;
		} finally {
			scheduler_mode = previous_scheduler_mode;
			queued_root_effects = previous_queued_root_effects;
		}
	}

	/**
	 * @template V
	 * @param {Value<V>} signal
	 * @returns {V}
	 */
	function get(signal) {
		var flags = signal.f;
		var is_derived = (flags & DERIVED) !== 0;

		// If the derived is destroyed, just execute it again without retaining
		// its memoisation properties as the derived is stale
		if (is_derived && (flags & DESTROYED) !== 0) {
			var value = execute_derived(/** @type {Derived} */ (signal));
			// Ensure the derived remains destroyed
			destroy_derived(/** @type {Derived} */ (signal));
			return value;
		}

		// Register the dependency on the current reaction signal.
		if (active_reaction !== null) {
			if (derived_sources !== null && derived_sources.includes(signal)) {
				state_unsafe_local_read();
			}
			var deps = active_reaction.deps;
			if (signal.rv < read_version) {
				signal.rv = read_version;
				// If the signal is accessing the same dependencies in the same
				// order as it did last time, increment `skipped_deps`
				// rather than updating `new_deps`, which creates GC cost
				if (new_deps === null && deps !== null && deps[skipped_deps] === signal) {
					skipped_deps++;
				} else if (new_deps === null) {
					new_deps = [signal];
				} else {
					new_deps.push(signal);
				}

				if (
					untracked_writes !== null &&
					active_effect !== null &&
					(active_effect.f & CLEAN) !== 0 &&
					(active_effect.f & BRANCH_EFFECT) === 0 &&
					untracked_writes.includes(signal)
				) {
					set_signal_status(active_effect, DIRTY);
					schedule_effect(active_effect);
				}
			}
		} else if (is_derived && /** @type {Derived} */ (signal).deps === null) {
			var derived = /** @type {Derived} */ (signal);
			var parent = derived.parent;
			var target = derived;

			while (parent !== null) {
				// Attach the derived to the nearest parent effect, if there are deriveds
				// in between then we also need to attach them too
				if ((parent.f & DERIVED) !== 0) {
					var parent_derived = /** @type {Derived} */ (parent);

					target = parent_derived;
					parent = parent_derived.parent;
				} else {
					var parent_effect = /** @type {Effect} */ (parent);

					if (!parent_effect.deriveds?.includes(target)) {
						(parent_effect.deriveds ??= []).push(target);
					}
					break;
				}
			}
		}

		if (is_derived) {
			derived = /** @type {Derived} */ (signal);

			if (check_dirtiness(derived)) {
				update_derived(derived);
			}
		}

		return signal.v;
	}

	/**
	 * When used inside a [`$derived`](https://svelte.dev/docs/svelte/$derived) or [`$effect`](https://svelte.dev/docs/svelte/$effect),
	 * any state read inside `fn` will not be treated as a dependency.
	 *
	 * ```ts
	 * $effect(() => {
	 *   // this will run when `data` changes, but not when `time` changes
	 *   save(data, {
	 *     timestamp: untrack(() => time)
	 *   });
	 * });
	 * ```
	 * @template T
	 * @param {() => T} fn
	 * @returns {T}
	 */
	function untrack(fn) {
		const previous_reaction = active_reaction;
		try {
			active_reaction = null;
			return fn();
		} finally {
			active_reaction = previous_reaction;
		}
	}

	const STATUS_MASK = -7169;

	/**
	 * @param {Signal} signal
	 * @param {number} status
	 * @returns {void}
	 */
	function set_signal_status(signal, status) {
		signal.f = (signal.f & STATUS_MASK) | status;
	}

	/**
	 * @param {Record<string, unknown>} props
	 * @param {any} runes
	 * @param {Function} [fn]
	 * @returns {void}
	 */
	function push(props, runes = false, fn) {
		component_context = {
			p: component_context,
			c: null,
			e: null,
			m: false,
			s: props,
			x: null,
			l: null
		};

		if (legacy_mode_flag && !runes) {
			component_context.l = {
				s: null,
				u: null,
				r1: [],
				r2: source(false)
			};
		}
	}

	/**
	 * @template {Record<string, any>} T
	 * @param {T} [component]
	 * @returns {T}
	 */
	function pop(component) {
		const context_stack_item = component_context;
		if (context_stack_item !== null) {
			const component_effects = context_stack_item.e;
			if (component_effects !== null) {
				var previous_effect = active_effect;
				var previous_reaction = active_reaction;
				context_stack_item.e = null;
				try {
					for (var i = 0; i < component_effects.length; i++) {
						var component_effect = component_effects[i];
						set_active_effect(component_effect.effect);
						set_active_reaction(component_effect.reaction);
						effect(component_effect.fn);
					}
				} finally {
					set_active_effect(previous_effect);
					set_active_reaction(previous_reaction);
				}
			}
			component_context = context_stack_item.p;
			context_stack_item.m = true;
		}
		// Micro-optimization: Don't set .a above to the empty object
		// so it can be garbage-collected when the return here is unused
		return /** @type {T} */ ({});
	}

	/**
	 * Possibly traverse an object and read all its properties so that they're all reactive in case this is `$state`.
	 * Does only check first level of an object for performance reasons (heuristic should be good for 99% of all cases).
	 * @param {any} value
	 * @returns {void}
	 */
	function deep_read_state(value) {
		if (typeof value !== 'object' || !value || value instanceof EventTarget) {
			return;
		}

		if (STATE_SYMBOL in value) {
			deep_read(value);
		} else if (!Array.isArray(value)) {
			for (let key in value) {
				const prop = value[key];
				if (typeof prop === 'object' && prop && STATE_SYMBOL in prop) {
					deep_read(prop);
				}
			}
		}
	}

	/**
	 * Deeply traverse an object and read all its properties
	 * so that they're all reactive in case this is `$state`
	 * @param {any} value
	 * @param {Set<any>} visited
	 * @returns {void}
	 */
	function deep_read(value, visited = new Set()) {
		if (
			typeof value === 'object' &&
			value !== null &&
			// We don't want to traverse DOM elements
			!(value instanceof EventTarget) &&
			!visited.has(value)
		) {
			visited.add(value);
			// When working with a possible SvelteDate, this
			// will ensure we capture changes to it.
			if (value instanceof Date) {
				value.getTime();
			}
			for (let key in value) {
				try {
					deep_read(value[key], visited);
				} catch (e) {
					// continue
				}
			}
			const proto = get_prototype_of(value);
			if (
				proto !== Object.prototype &&
				proto !== Array.prototype &&
				proto !== Map.prototype &&
				proto !== Set.prototype &&
				proto !== Date.prototype
			) {
				const descriptors = get_descriptors(proto);
				for (let key in descriptors) {
					const get = descriptors[key].get;
					if (get) {
						try {
							get.call(value);
						} catch (e) {
							// continue
						}
					}
				}
			}
		}
	}

	/**
	 * Subset of delegated events which should be passive by default.
	 * These two are already passive via browser defaults on window, document and body.
	 * But since
	 * - we're delegating them
	 * - they happen often
	 * - they apply to mobile which is generally less performant
	 * we're marking them as passive by default for other elements, too.
	 */
	const PASSIVE_EVENTS = ['touchstart', 'touchmove'];

	/**
	 * Returns `true` if `name` is a passive event
	 * @param {string} name
	 */
	function is_passive_event(name) {
		return PASSIVE_EVENTS.includes(name);
	}

	/** @import { Location } from 'locate-character' */

	/** @type {Set<string>} */
	const all_registered_events = new Set();

	/** @type {Set<(events: Array<string>) => void>} */
	const root_event_handles = new Set();

	/**
	 * @this {EventTarget}
	 * @param {Event} event
	 * @returns {void}
	 */
	function handle_event_propagation(event) {
		var handler_element = this;
		var owner_document = /** @type {Node} */ (handler_element).ownerDocument;
		var event_name = event.type;
		var path = event.composedPath?.() || [];
		var current_target = /** @type {null | Element} */ (path[0] || event.target);

		// composedPath contains list of nodes the event has propagated through.
		// We check __root to skip all nodes below it in case this is a
		// parent of the __root node, which indicates that there's nested
		// mounted apps. In this case we don't want to trigger events multiple times.
		var path_idx = 0;

		// @ts-expect-error is added below
		var handled_at = event.__root;

		if (handled_at) {
			var at_idx = path.indexOf(handled_at);
			if (
				at_idx !== -1 &&
				(handler_element === document || handler_element === /** @type {any} */ (window))
			) {
				// This is the fallback document listener or a window listener, but the event was already handled
				// -> ignore, but set handle_at to document/window so that we're resetting the event
				// chain in case someone manually dispatches the same event object again.
				// @ts-expect-error
				event.__root = handler_element;
				return;
			}

			// We're deliberately not skipping if the index is higher, because
			// someone could create an event programmatically and emit it multiple times,
			// in which case we want to handle the whole propagation chain properly each time.
			// (this will only be a false negative if the event is dispatched multiple times and
			// the fallback document listener isn't reached in between, but that's super rare)
			var handler_idx = path.indexOf(handler_element);
			if (handler_idx === -1) {
				// handle_idx can theoretically be -1 (happened in some JSDOM testing scenarios with an event listener on the window object)
				// so guard against that, too, and assume that everything was handled at this point.
				return;
			}

			if (at_idx <= handler_idx) {
				path_idx = at_idx;
			}
		}

		current_target = /** @type {Element} */ (path[path_idx] || event.target);
		// there can only be one delegated event per element, and we either already handled the current target,
		// or this is the very first target in the chain which has a non-delegated listener, in which case it's safe
		// to handle a possible delegated event on it later (through the root delegation listener for example).
		if (current_target === handler_element) return;

		// Proxy currentTarget to correct target
		define_property(event, 'currentTarget', {
			configurable: true,
			get() {
				return current_target || owner_document;
			}
		});

		// This started because of Chromium issue https://chromestatus.com/feature/5128696823545856,
		// where removal or moving of of the DOM can cause sync `blur` events to fire, which can cause logic
		// to run inside the current `active_reaction`, which isn't what we want at all. However, on reflection,
		// it's probably best that all event handled by Svelte have this behaviour, as we don't really want
		// an event handler to run in the context of another reaction or effect.
		var previous_reaction = active_reaction;
		var previous_effect = active_effect;
		set_active_reaction(null);
		set_active_effect(null);

		try {
			/**
			 * @type {unknown}
			 */
			var throw_error;
			/**
			 * @type {unknown[]}
			 */
			var other_errors = [];

			while (current_target !== null) {
				/** @type {null | Element} */
				var parent_element =
					current_target.assignedSlot ||
					current_target.parentNode ||
					/** @type {any} */ (current_target).host ||
					null;

				try {
					// @ts-expect-error
					var delegated = current_target['__' + event_name];

					if (delegated !== undefined && !(/** @type {any} */ (current_target).disabled)) {
						if (is_array(delegated)) {
							var [fn, ...data] = delegated;
							fn.apply(current_target, [event, ...data]);
						} else {
							delegated.call(current_target, event);
						}
					}
				} catch (error) {
					if (throw_error) {
						other_errors.push(error);
					} else {
						throw_error = error;
					}
				}
				if (event.cancelBubble || parent_element === handler_element || parent_element === null) {
					break;
				}
				current_target = parent_element;
			}

			if (throw_error) {
				for (let error of other_errors) {
					// Throw the rest of the errors, one-by-one on a microtask
					queueMicrotask(() => {
						throw error;
					});
				}
				throw throw_error;
			}
		} finally {
			// @ts-expect-error is used above
			event.__root = handler_element;
			// @ts-ignore remove proxy on currentTarget
			delete event.currentTarget;
			set_active_reaction(previous_reaction);
			set_active_effect(previous_effect);
		}
	}

	/** @param {string} html */
	function create_fragment_from_html(html) {
		var elem = document.createElement('template');
		elem.innerHTML = html;
		return elem.content;
	}

	/** @import { Effect, TemplateNode } from '#client' */

	/**
	 * @param {TemplateNode} start
	 * @param {TemplateNode | null} end
	 */
	function assign_nodes(start, end) {
		var effect = /** @type {Effect} */ (active_effect);
		if (effect.nodes_start === null) {
			effect.nodes_start = start;
			effect.nodes_end = end;
		}
	}

	/**
	 * @param {string} content
	 * @param {number} flags
	 * @returns {() => Node | Node[]}
	 */
	/*#__NO_SIDE_EFFECTS__*/
	function template(content, flags) {
		var use_import_node = (flags & TEMPLATE_USE_IMPORT_NODE) !== 0;

		/** @type {Node} */
		var node;

		/**
		 * Whether or not the first item is a text/element node. If not, we need to
		 * create an additional comment node to act as `effect.nodes.start`
		 */
		var has_start = !content.startsWith('<!>');

		return () => {

			if (node === undefined) {
				node = create_fragment_from_html(has_start ? content : '<!>' + content);
				node = /** @type {Node} */ (get_first_child(node));
			}

			var clone = /** @type {TemplateNode} */ (
				use_import_node ? document.importNode(node, true) : node.cloneNode(true)
			);

			{
				assign_nodes(clone, clone);
			}

			return clone;
		};
	}

	function comment() {

		var frag = document.createDocumentFragment();
		var start = document.createComment('');
		var anchor = create_text();
		frag.append(start, anchor);

		assign_nodes(start, anchor);

		return frag;
	}

	/**
	 * Assign the created (or in hydration mode, traversed) dom elements to the current block
	 * and insert the elements into the dom (in client mode).
	 * @param {Text | Comment | Element} anchor
	 * @param {DocumentFragment | Element} dom
	 */
	function append(anchor, dom) {

		if (anchor === null) {
			// edge case — void `<svelte:element>` with content
			return;
		}

		anchor.before(/** @type {Node} */ (dom));
	}

	/** @import { ComponentContext, Effect, TemplateNode } from '#client' */
	/** @import { Component, ComponentType, SvelteComponent, MountOptions } from '../../index.js' */

	/**
	 * @param {Element} text
	 * @param {string} value
	 * @returns {void}
	 */
	function set_text(text, value) {
		// For objects, we apply string coercion (which might make things like $state array references in the template reactive) before diffing
		var str = value == null ? '' : typeof value === 'object' ? value + '' : value;
		// @ts-expect-error
		if (str !== (text.__t ??= text.nodeValue)) {
			// @ts-expect-error
			text.__t = str;
			text.nodeValue = str == null ? '' : str + '';
		}
	}

	/**
	 * Mounts a component to the given target and returns the exports and potentially the props (if compiled with `accessors: true`) of the component.
	 * Transitions will play during the initial render unless the `intro` option is set to `false`.
	 *
	 * @template {Record<string, any>} Props
	 * @template {Record<string, any>} Exports
	 * @param {ComponentType<SvelteComponent<Props>> | Component<Props, Exports, any>} component
	 * @param {MountOptions<Props>} options
	 * @returns {Exports}
	 */
	function mount(component, options) {
		return _mount(component, options);
	}

	/** @type {Map<string, number>} */
	const document_listeners = new Map();

	/**
	 * @template {Record<string, any>} Exports
	 * @param {ComponentType<SvelteComponent<any>> | Component<any>} Component
	 * @param {MountOptions} options
	 * @returns {Exports}
	 */
	function _mount(Component, { target, anchor, props = {}, events, context, intro = true }) {
		init_operations();

		var registered_events = new Set();

		/** @param {Array<string>} events */
		var event_handle = (events) => {
			for (var i = 0; i < events.length; i++) {
				var event_name = events[i];

				if (registered_events.has(event_name)) continue;
				registered_events.add(event_name);

				var passive = is_passive_event(event_name);

				// Add the event listener to both the container and the document.
				// The container listener ensures we catch events from within in case
				// the outer content stops propagation of the event.
				target.addEventListener(event_name, handle_event_propagation, { passive });

				var n = document_listeners.get(event_name);

				if (n === undefined) {
					// The document listener ensures we catch events that originate from elements that were
					// manually moved outside of the container (e.g. via manual portals).
					document.addEventListener(event_name, handle_event_propagation, { passive });
					document_listeners.set(event_name, 1);
				} else {
					document_listeners.set(event_name, n + 1);
				}
			}
		};

		event_handle(array_from(all_registered_events));
		root_event_handles.add(event_handle);

		/** @type {Exports} */
		// @ts-expect-error will be defined because the render effect runs synchronously
		var component = undefined;

		var unmount = component_root(() => {
			var anchor_node = anchor ?? target.appendChild(create_text());

			branch(() => {
				if (context) {
					push({});
					var ctx = /** @type {ComponentContext} */ (component_context);
					ctx.c = context;
				}

				if (events) {
					// We can't spread the object or else we'd lose the state proxy stuff, if it is one
					/** @type {any} */ (props).$$events = events;
				}
				// @ts-expect-error the public typings are not what the actual function looks like
				component = Component(anchor_node, props) || {};

				if (context) {
					pop();
				}
			});

			return () => {
				for (var event_name of registered_events) {
					target.removeEventListener(event_name, handle_event_propagation);

					var n = /** @type {number} */ (document_listeners.get(event_name));

					if (--n === 0) {
						document.removeEventListener(event_name, handle_event_propagation);
						document_listeners.delete(event_name);
					} else {
						document_listeners.set(event_name, n);
					}
				}

				root_event_handles.delete(event_handle);

				if (anchor_node !== anchor) {
					anchor_node.parentNode?.removeChild(anchor_node);
				}
			};
		});

		mounted_components.set(component, unmount);
		return component;
	}

	/**
	 * References of the components that were mounted or hydrated.
	 * Uses a `WeakMap` to avoid memory leaks.
	 */
	let mounted_components = new WeakMap();

	/** @import { Effect, Source, TemplateNode } from '#client' */

	const PENDING = 0;
	const THEN = 1;
	const CATCH = 2;

	/**
	 * @template V
	 * @param {TemplateNode} node
	 * @param {(() => Promise<V>)} get_input
	 * @param {null | ((anchor: Node) => void)} pending_fn
	 * @param {null | ((anchor: Node, value: Source<V>) => void)} then_fn
	 * @param {null | ((anchor: Node, error: unknown) => void)} catch_fn
	 * @returns {void}
	 */
	function await_block(node, get_input, pending_fn, then_fn, catch_fn) {

		var anchor = node;
		var runes = is_runes();
		var active_component_context = component_context;

		/** @type {V | Promise<V> | typeof UNINITIALIZED} */
		var input = UNINITIALIZED;

		/** @type {Effect | null} */
		var pending_effect;

		/** @type {Effect | null} */
		var then_effect;

		/** @type {Effect | null} */
		var catch_effect;

		var input_source = (runes ? source : mutable_source)(/** @type {V} */ (undefined));
		var error_source = (runes ? source : mutable_source)(undefined);
		var resolved = false;

		/**
		 * @param {PENDING | THEN | CATCH} state
		 * @param {boolean} restore
		 */
		function update(state, restore) {
			resolved = true;

			if (restore) {
				set_active_effect(effect);
				set_active_reaction(effect); // TODO do we need both?
				set_component_context(active_component_context);
			}

			try {
				if (state === PENDING && pending_fn) {
					if (pending_effect) resume_effect(pending_effect);
					else pending_effect = branch(() => pending_fn(anchor));
				}

				if (state === THEN && then_fn) {
					if (then_effect) resume_effect(then_effect);
					else then_effect = branch(() => then_fn(anchor, input_source));
				}

				if (state === CATCH && catch_fn) ;

				if (state !== PENDING && pending_effect) {
					pause_effect(pending_effect, () => (pending_effect = null));
				}

				if (state !== THEN && then_effect) {
					pause_effect(then_effect, () => (then_effect = null));
				}

				if (state !== CATCH && catch_effect) {
					pause_effect(catch_effect, () => (catch_effect = null));
				}
			} finally {
				if (restore) {
					set_component_context(null);
					set_active_reaction(null);
					set_active_effect(null);

					// without this, the DOM does not update until two ticks after the promise
					// resolves, which is unexpected behaviour (and somewhat irksome to test)
					flush_sync();
				}
			}
		}

		var effect = block(() => {
			if (input === (input = get_input())) return;

			if (is_promise(input)) {
				var promise = input;

				resolved = false;

				promise.then(
					(value) => {
						if (promise !== input) return;
						// we technically could use `set` here since it's on the next microtick
						// but let's use internal_set for consistency and just to be safe
						internal_set(input_source, value);
						update(THEN, true);
					},
					(error) => {
						if (promise !== input) return;
						// we technically could use `set` here since it's on the next microtick
						// but let's use internal_set for consistency and just to be safe
						internal_set(error_source, error);
						update(CATCH, true);
						{
							// Rethrow the error if no catch block exists
							throw error_source.v;
						}
					}
				);

				{
					// Wait a microtask before checking if we should show the pending state as
					// the promise might have resolved by the next microtask.
					queue_micro_task(() => {
						if (!resolved) update(PENDING, true);
					});
				}
			} else {
				internal_set(input_source, input);
				update(THEN, false);
			}

			// Set the input to something else, in order to disable the promise callbacks
			return () => (input = UNINITIALIZED);
		});
	}

	/** @import { Effect, TemplateNode } from '#client' */

	/**
	 * @param {TemplateNode} node
	 * @param {(branch: (fn: (anchor: Node) => void, flag?: boolean) => void) => void} fn
	 * @param {boolean} [elseif] True if this is an `{:else if ...}` block rather than an `{#if ...}`, as that affects which transitions are considered 'local'
	 * @returns {void}
	 */
	function if_block(node, fn, elseif = false) {

		var anchor = node;

		/** @type {Effect | null} */
		var consequent_effect = null;

		/** @type {Effect | null} */
		var alternate_effect = null;

		/** @type {UNINITIALIZED | boolean | null} */
		var condition = UNINITIALIZED;

		var flags = elseif ? EFFECT_TRANSPARENT : 0;

		var has_branch = false;

		const set_branch = (/** @type {(anchor: Node) => void} */ fn, flag = true) => {
			has_branch = true;
			update_branch(flag, fn);
		};

		const update_branch = (
			/** @type {boolean | null} */ new_condition,
			/** @type {null | ((anchor: Node) => void)} */ fn
		) => {
			if (condition === (condition = new_condition)) return;

			if (condition) {
				if (consequent_effect) {
					resume_effect(consequent_effect);
				} else if (fn) {
					consequent_effect = branch(() => fn(anchor));
				}

				if (alternate_effect) {
					pause_effect(alternate_effect, () => {
						alternate_effect = null;
					});
				}
			} else {
				if (alternate_effect) {
					resume_effect(alternate_effect);
				} else if (fn) {
					alternate_effect = branch(() => fn(anchor));
				}

				if (consequent_effect) {
					pause_effect(consequent_effect, () => {
						consequent_effect = null;
					});
				}
			}
		};

		block(() => {
			has_branch = false;
			fn(set_branch);
			if (!has_branch) {
				update_branch(null, null);
			}
		}, flags);
	}

	/** @import { EachItem, EachState, Effect, MaybeSource, Source, TemplateNode, TransitionManager, Value } from '#client' */

	/**
	 * @param {any} _
	 * @param {number} i
	 */
	function index(_, i) {
		return i;
	}

	/**
	 * Pause multiple effects simultaneously, and coordinate their
	 * subsequent destruction. Used in each blocks
	 * @param {EachState} state
	 * @param {EachItem[]} items
	 * @param {null | Node} controlled_anchor
	 * @param {Map<any, EachItem>} items_map
	 */
	function pause_effects(state, items, controlled_anchor, items_map) {
		/** @type {TransitionManager[]} */
		var transitions = [];
		var length = items.length;

		for (var i = 0; i < length; i++) {
			pause_children(items[i].e, transitions, true);
		}

		var is_controlled = length > 0 && transitions.length === 0 && controlled_anchor !== null;
		// If we have a controlled anchor, it means that the each block is inside a single
		// DOM element, so we can apply a fast-path for clearing the contents of the element.
		if (is_controlled) {
			var parent_node = /** @type {Element} */ (
				/** @type {Element} */ (controlled_anchor).parentNode
			);
			clear_text_content(parent_node);
			parent_node.append(/** @type {Element} */ (controlled_anchor));
			items_map.clear();
			link(state, items[0].prev, items[length - 1].next);
		}

		run_out_transitions(transitions, () => {
			for (var i = 0; i < length; i++) {
				var item = items[i];
				if (!is_controlled) {
					items_map.delete(item.k);
					link(state, item.prev, item.next);
				}
				destroy_effect(item.e, !is_controlled);
			}
		});
	}

	/**
	 * @template V
	 * @param {Element | Comment} node The next sibling node, or the parent node if this is a 'controlled' block
	 * @param {number} flags
	 * @param {() => V[]} get_collection
	 * @param {(value: V, index: number) => any} get_key
	 * @param {(anchor: Node, item: MaybeSource<V>, index: MaybeSource<number>) => void} render_fn
	 * @param {null | ((anchor: Node) => void)} fallback_fn
	 * @returns {void}
	 */
	function each(node, flags, get_collection, get_key, render_fn, fallback_fn = null) {
		var anchor = node;

		/** @type {EachState} */
		var state = { flags, items: new Map(), first: null };

		/** @type {Effect | null} */
		var fallback = null;

		var was_empty = false;

		block(() => {
			var collection = get_collection();

			var array = is_array(collection)
				? collection
				: collection == null
					? []
					: array_from(collection);

			var length = array.length;

			if (was_empty && length === 0) {
				// ignore updates if the array is empty,
				// and it already was empty on previous run
				return;
			}
			was_empty = length === 0;

			{
				var effect = /** @type {Effect} */ (active_reaction);
				reconcile(
					array,
					state,
					anchor,
					render_fn,
					flags,
					(effect.f & INERT) !== 0,
					get_key);
			}

			if (fallback_fn !== null) {
				if (length === 0) {
					if (fallback) {
						resume_effect(fallback);
					} else {
						fallback = branch(() => fallback_fn(anchor));
					}
				} else if (fallback !== null) {
					pause_effect(fallback, () => {
						fallback = null;
					});
				}
			}

			// When we mount the each block for the first time, the collection won't be
			// connected to this effect as the effect hasn't finished running yet and its deps
			// won't be assigned. However, it's possible that when reconciling the each block
			// that a mutation occurred and it's made the collection MAYBE_DIRTY, so reading the
			// collection again can provide consistency to the reactive graph again as the deriveds
			// will now be `CLEAN`.
			get_collection();
		});
	}

	/**
	 * Add, remove, or reorder items output by an each block as its input changes
	 * @template V
	 * @param {Array<V>} array
	 * @param {EachState} state
	 * @param {Element | Comment | Text} anchor
	 * @param {(anchor: Node, item: MaybeSource<V>, index: number | Source<number>) => void} render_fn
	 * @param {number} flags
	 * @param {boolean} is_inert
	 * @param {(value: V, index: number) => any} get_key
	 * @param {() => V[]} get_collection
	 * @returns {void}
	 */
	function reconcile(array, state, anchor, render_fn, flags, is_inert, get_key, get_collection) {

		var length = array.length;
		var items = state.items;
		var first = state.first;
		var current = first;

		/** @type {undefined | Set<EachItem>} */
		var seen;

		/** @type {EachItem | null} */
		var prev = null;

		/** @type {EachItem[]} */
		var matched = [];

		/** @type {EachItem[]} */
		var stashed = [];

		/** @type {V} */
		var value;

		/** @type {any} */
		var key;

		/** @type {EachItem | undefined} */
		var item;

		/** @type {number} */
		var i;

		for (i = 0; i < length; i += 1) {
			value = array[i];
			key = get_key(value, i);
			item = items.get(key);

			if (item === undefined) {
				var child_anchor = current ? /** @type {TemplateNode} */ (current.e.nodes_start) : anchor;

				prev = create_item(
					child_anchor,
					state,
					prev,
					prev === null ? state.first : prev.next,
					value,
					key,
					i,
					render_fn,
					flags);

				items.set(key, prev);

				matched = [];
				stashed = [];

				current = prev.next;
				continue;
			}

			{
				update_item(item, value, i);
			}

			if ((item.e.f & INERT) !== 0) {
				resume_effect(item.e);
			}

			if (item !== current) {
				if (seen !== undefined && seen.has(item)) {
					if (matched.length < stashed.length) {
						// more efficient to move later items to the front
						var start = stashed[0];
						var j;

						prev = start.prev;

						var a = matched[0];
						var b = matched[matched.length - 1];

						for (j = 0; j < matched.length; j += 1) {
							move(matched[j], start, anchor);
						}

						for (j = 0; j < stashed.length; j += 1) {
							seen.delete(stashed[j]);
						}

						link(state, a.prev, b.next);
						link(state, prev, a);
						link(state, b, start);

						current = start;
						prev = b;
						i -= 1;

						matched = [];
						stashed = [];
					} else {
						// more efficient to move earlier items to the back
						seen.delete(item);
						move(item, current, anchor);

						link(state, item.prev, item.next);
						link(state, item, prev === null ? state.first : prev.next);
						link(state, prev, item);

						prev = item;
					}

					continue;
				}

				matched = [];
				stashed = [];

				while (current !== null && current.k !== key) {
					// If the each block isn't inert and an item has an effect that is already inert,
					// skip over adding it to our seen Set as the item is already being handled
					if (is_inert || (current.e.f & INERT) === 0) {
						(seen ??= new Set()).add(current);
					}
					stashed.push(current);
					current = current.next;
				}

				if (current === null) {
					continue;
				}

				item = current;
			}

			matched.push(item);
			prev = item;
			current = item.next;
		}

		if (current !== null || seen !== undefined) {
			var to_destroy = seen === undefined ? [] : array_from(seen);

			while (current !== null) {
				// If the each block isn't inert, then inert effects are currently outroing and will be removed once the transition is finished
				if (is_inert || (current.e.f & INERT) === 0) {
					to_destroy.push(current);
				}
				current = current.next;
			}

			var destroy_length = to_destroy.length;

			if (destroy_length > 0) {
				var controlled_anchor = null;

				pause_effects(state, to_destroy, controlled_anchor, items);
			}
		}

		/** @type {Effect} */ (active_effect).first = state.first && state.first.e;
		/** @type {Effect} */ (active_effect).last = prev && prev.e;
	}

	/**
	 * @param {EachItem} item
	 * @param {any} value
	 * @param {number} index
	 * @param {number} type
	 * @returns {void}
	 */
	function update_item(item, value, index, type) {
		{
			internal_set(item.v, value);
		}

		{
			item.i = index;
		}
	}

	/**
	 * @template V
	 * @param {Node} anchor
	 * @param {EachState} state
	 * @param {EachItem | null} prev
	 * @param {EachItem | null} next
	 * @param {V} value
	 * @param {unknown} key
	 * @param {number} index
	 * @param {(anchor: Node, item: V | Source<V>, index: number | Value<number>) => void} render_fn
	 * @param {number} flags
	 * @param {() => V[]} get_collection
	 * @returns {EachItem}
	 */
	function create_item(
		anchor,
		state,
		prev,
		next,
		value,
		key,
		index,
		render_fn,
		flags,
		get_collection
	) {
		var reactive = (flags & EACH_ITEM_REACTIVE) !== 0;
		var mutable = (flags & EACH_ITEM_IMMUTABLE) === 0;

		var v = reactive ? (mutable ? mutable_source(value) : source(value)) : value;
		var i = (flags & EACH_INDEX_REACTIVE) === 0 ? index : source(index);

		/** @type {EachItem} */
		var item = {
			i,
			v,
			k: key,
			a: null,
			// @ts-expect-error
			e: null,
			prev,
			next
		};

		try {
			item.e = branch(() => render_fn(anchor, v, i), hydrating);

			item.e.prev = prev && prev.e;
			item.e.next = next && next.e;

			if (prev === null) {
				state.first = item;
			} else {
				prev.next = item;
				prev.e.next = item.e;
			}

			if (next !== null) {
				next.prev = item;
				next.e.prev = item.e;
			}

			return item;
		} finally {
		}
	}

	/**
	 * @param {EachItem} item
	 * @param {EachItem | null} next
	 * @param {Text | Element | Comment} anchor
	 */
	function move(item, next, anchor) {
		var end = item.next ? /** @type {TemplateNode} */ (item.next.e.nodes_start) : anchor;

		var dest = next ? /** @type {TemplateNode} */ (next.e.nodes_start) : anchor;
		var node = /** @type {TemplateNode} */ (item.e.nodes_start);

		while (node !== end) {
			var next_node = /** @type {TemplateNode} */ (get_next_sibling(node));
			dest.before(node);
			node = next_node;
		}
	}

	/**
	 * @param {EachState} state
	 * @param {EachItem | null} prev
	 * @param {EachItem | null} next
	 */
	function link(state, prev, next) {
		if (prev === null) {
			state.first = next;
		} else {
			prev.next = next;
			prev.e.next = next && next.e;
		}

		if (next !== null) {
			next.prev = prev;
			next.e.prev = prev && prev.e;
		}
	}

	/**
	 * @param {Element} element
	 * @param {string} attribute
	 * @param {string | null} value
	 * @param {boolean} [skip_warning]
	 */
	function set_attribute(element, attribute, value, skip_warning) {
		// @ts-expect-error
		var attributes = (element.__attributes ??= {});

		if (attributes[attribute] === (attributes[attribute] = value)) return;

		if (attribute === 'style' && '__styles' in element) {
			// reset styles to force style: directive to update
			element.__styles = {};
		}

		if (attribute === 'loading') {
			// @ts-expect-error
			element[LOADING_ATTR_SYMBOL] = value;
		}

		if (value == null) {
			element.removeAttribute(attribute);
		} else if (typeof value !== 'string' && get_setters(element).includes(attribute)) {
			// @ts-ignore
			element[attribute] = value;
		} else {
			element.setAttribute(attribute, value);
		}
	}

	/** @type {Map<string, string[]>} */
	var setters_cache = new Map();

	/** @param {Element} element */
	function get_setters(element) {
		var setters = setters_cache.get(element.nodeName);
		if (setters) return setters;
		setters_cache.set(element.nodeName, (setters = []));

		var descriptors;
		var proto = element; // In the case of custom elements there might be setters on the instance
		var element_proto = Element.prototype;

		// Stop at Element, from there on there's only unnecessary setters we're not interested in
		// Do not use contructor.name here as that's unreliable in some browser environments
		while (element_proto !== proto) {
			descriptors = get_descriptors(proto);

			for (var key in descriptors) {
				if (descriptors[key].set) {
					setters.push(key);
				}
			}

			proto = get_prototype_of(proto);
		}

		return setters;
	}

	/**
	 * @param {HTMLElement} dom
	 * @param {string} value
	 * @param {string} [hash]
	 * @returns {void}
	 */
	function set_class(dom, value, hash) {
		// @ts-expect-error need to add __className to patched prototype
		var prev_class_name = dom.__className;
		var next_class_name = to_class(value);

		if (
			prev_class_name !== next_class_name ||
			(hydrating)
		) {
			// Removing the attribute when the value is only an empty string causes
			// peformance issues vs simply making the className an empty string. So
			// we should only remove the class if the the value is nullish.
			if (value == null && true) {
				dom.removeAttribute('class');
			} else {
				dom.className = next_class_name;
			}

			// @ts-expect-error need to add __className to patched prototype
			dom.__className = next_class_name;
		}
	}

	/**
	 * @template V
	 * @param {V} value
	 * @param {string} [hash]
	 * @returns {string | V}
	 */
	function to_class(value, hash) {
		return (value == null ? '' : value) + ('');
	}

	/** @import { ComponentContextLegacy } from '#client' */

	/**
	 * Legacy-mode only: Call `onMount` callbacks and set up `beforeUpdate`/`afterUpdate` effects
	 * @param {boolean} [immutable]
	 */
	function init(immutable = false) {
		const context = /** @type {ComponentContextLegacy} */ (component_context);

		const callbacks = context.l.u;
		if (!callbacks) return;

		let props = () => deep_read_state(context.s);

		if (immutable) {
			let version = 0;
			let prev = /** @type {Record<string, any>} */ ({});

			// In legacy immutable mode, before/afterUpdate only fire if the object identity of a prop changes
			const d = derived(() => {
				let changed = false;
				const props = context.s;
				for (const key in props) {
					if (props[key] !== prev[key]) {
						prev[key] = props[key];
						changed = true;
					}
				}
				if (changed) version++;
				return version;
			});

			props = () => get(d);
		}

		// beforeUpdate
		if (callbacks.b.length) {
			user_pre_effect(() => {
				observe_all(context, props);
				run_all(callbacks.b);
			});
		}

		// onMount (must run before afterUpdate)
		user_effect(() => {
			const fns = untrack(() => callbacks.m.map(run));
			return () => {
				for (const fn of fns) {
					if (typeof fn === 'function') {
						fn();
					}
				}
			};
		});

		// afterUpdate
		if (callbacks.a.length) {
			user_effect(() => {
				observe_all(context, props);
				run_all(callbacks.a);
			});
		}
	}

	/**
	 * Invoke the getter of all signals associated with a component
	 * so they can be registered to the effect this function is called in.
	 * @param {ComponentContextLegacy} context
	 * @param {(() => void)} props
	 */
	function observe_all(context, props) {
		if (context.l.s) {
			for (const signal of context.l.s) get(signal);
		}

		props();
	}

	/** @import { StoreReferencesContainer } from '#client' */
	/** @import { Store } from '#shared' */

	/**
	 * Whether or not the prop currently being read is a store binding, as in
	 * `<Child bind:x={$y} />`. If it is, we treat the prop as mutable even in
	 * runes mode, and skip `binding_property_non_reactive` validation
	 */
	let is_store_binding = false;

	/**
	 * Returns a tuple that indicates whether `fn()` reads a prop that is a store binding.
	 * Used to prevent `binding_property_non_reactive` validation false positives and
	 * ensure that these props are treated as mutable even in runes mode
	 * @template T
	 * @param {() => T} fn
	 * @returns {[T, boolean]}
	 */
	function capture_store_binding(fn) {
		var previous_is_store_binding = is_store_binding;

		try {
			is_store_binding = false;
			return [fn(), is_store_binding];
		} finally {
			is_store_binding = previous_is_store_binding;
		}
	}

	/** @import { Source } from './types.js' */

	/**
	 * @template T
	 * @param {() => T} fn
	 * @returns {T}
	 */
	function with_parent_branch(fn) {
		var effect = active_effect;
		var previous_effect = active_effect;

		while (effect !== null && (effect.f & (BRANCH_EFFECT | ROOT_EFFECT)) === 0) {
			effect = effect.parent;
		}
		try {
			set_active_effect(effect);
			return fn();
		} finally {
			set_active_effect(previous_effect);
		}
	}

	/**
	 * This function is responsible for synchronizing a possibly bound prop with the inner component state.
	 * It is used whenever the compiler sees that the component writes to the prop, or when it has a default prop_value.
	 * @template V
	 * @param {Record<string, unknown>} props
	 * @param {string} key
	 * @param {number} flags
	 * @param {V | (() => V)} [fallback]
	 * @returns {(() => V | ((arg: V) => V) | ((arg: V, mutation: boolean) => V))}
	 */
	function prop(props, key, flags, fallback) {
		var immutable = (flags & PROPS_IS_IMMUTABLE) !== 0;
		var runes = !legacy_mode_flag || (flags & PROPS_IS_RUNES) !== 0;
		var bindable = (flags & PROPS_IS_BINDABLE) !== 0;
		var lazy = (flags & PROPS_IS_LAZY_INITIAL) !== 0;
		var is_store_sub = false;
		var prop_value;

		if (bindable) {
			[prop_value, is_store_sub] = capture_store_binding(() => /** @type {V} */ (props[key]));
		} else {
			prop_value = /** @type {V} */ (props[key]);
		}

		// Can be the case when someone does `mount(Component, props)` with `let props = $state({...})`
		// or `createClassComponent(Component, props)`
		var is_entry_props = STATE_SYMBOL in props || LEGACY_PROPS in props;

		var setter =
			(bindable &&
				(get_descriptor(props, key)?.set ??
					(is_entry_props && key in props && ((v) => (props[key] = v))))) ||
			undefined;

		var fallback_value = /** @type {V} */ (fallback);
		var fallback_dirty = true;
		var fallback_used = false;

		var get_fallback = () => {
			fallback_used = true;
			if (fallback_dirty) {
				fallback_dirty = false;
				if (lazy) {
					fallback_value = untrack(/** @type {() => V} */ (fallback));
				} else {
					fallback_value = /** @type {V} */ (fallback);
				}
			}

			return fallback_value;
		};

		if (prop_value === undefined && fallback !== undefined) {
			if (setter && runes) {
				props_invalid_value();
			}

			prop_value = get_fallback();
			if (setter) setter(prop_value);
		}

		/** @type {() => V} */
		var getter;
		if (runes) {
			getter = () => {
				var value = /** @type {V} */ (props[key]);
				if (value === undefined) return get_fallback();
				fallback_dirty = true;
				fallback_used = false;
				return value;
			};
		} else {
			// Svelte 4 did not trigger updates when a primitive value was updated to the same value.
			// Replicate that behavior through using a derived
			var derived_getter = with_parent_branch(() =>
				(immutable ? derived : derived_safe_equal)(() => /** @type {V} */ (props[key]))
			);
			derived_getter.f |= LEGACY_DERIVED_PROP;
			getter = () => {
				var value = get(derived_getter);
				if (value !== undefined) fallback_value = /** @type {V} */ (undefined);
				return value === undefined ? fallback_value : value;
			};
		}

		// easy mode — prop is never written to
		if ((flags & PROPS_IS_UPDATED) === 0) {
			return getter;
		}

		// intermediate mode — prop is written to, but the parent component had
		// `bind:foo` which means we can just call `$$props.foo = value` directly
		if (setter) {
			var legacy_parent = props.$$legacy;
			return function (/** @type {any} */ value, /** @type {boolean} */ mutation) {
				if (arguments.length > 0) {
					// We don't want to notify if the value was mutated and the parent is in runes mode.
					// In that case the state proxy (if it exists) should take care of the notification.
					// If the parent is not in runes mode, we need to notify on mutation, too, that the prop
					// has changed because the parent will not be able to detect the change otherwise.
					if (!runes || !mutation || legacy_parent || is_store_sub) {
						/** @type {Function} */ (setter)(mutation ? getter() : value);
					}
					return value;
				} else {
					return getter();
				}
			};
		}

		// hard mode. this is where it gets ugly — the value in the child should
		// synchronize with the parent, but it should also be possible to temporarily
		// set the value to something else locally.
		var from_child = false;
		var was_from_child = false;

		// The derived returns the current value. The underlying mutable
		// source is written to from various places to persist this value.
		var inner_current_value = mutable_source(prop_value);
		var current_value = with_parent_branch(() =>
			derived(() => {
				var parent_value = getter();
				var child_value = get(inner_current_value);

				if (from_child) {
					from_child = false;
					was_from_child = true;
					return child_value;
				}

				was_from_child = false;
				return (inner_current_value.v = parent_value);
			})
		);

		if (!immutable) current_value.equals = safe_equals;

		return function (/** @type {any} */ value, /** @type {boolean} */ mutation) {

			if (arguments.length > 0) {
				const new_value = mutation ? get(current_value) : runes && bindable ? proxy(value) : value;

				if (!current_value.equals(new_value)) {
					from_child = true;
					set(inner_current_value, new_value);
					// To ensure the fallback value is consistent when used with proxies, we
					// update the local fallback_value, but only if the fallback is actively used
					if (fallback_used && fallback_value !== undefined) {
						fallback_value = new_value;
					}
					untrack(() => get(current_value)); // force a synchronisation immediately
				}

				return value;
			}
			return get(current_value);
		};
	}

	// generated during release, do not modify

	const PUBLIC_VERSION = '5';

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte ||= { v: new Set() }).v.add(PUBLIC_VERSION);

	enable_legacy_mode_flag();

	var root = template(`<img alt="Product">`);

	function SirvImage($$anchor, $$props) {
		let width = prop($$props, "width", 8, 100);
		let height = prop($$props, "height", 8, 100);
		let quality = prop($$props, "quality", 8, 90);
		let src = prop($$props, "src", 8, "");
		let displayHeight = prop($$props, "displayHeight", 24, height);
		let displayWidth = prop($$props, "displayWidth", 24, width);
		var img = root();

		template_effect(() => {
			set_attribute(img, "src", `${src() ?? ""}?w=${width() ?? ""}&h=${height() ?? ""}&q=${quality() ?? ""}`);
			set_attribute(img, "width", displayWidth());
			set_attribute(img, "height", displayHeight());
		});

		append($$anchor, img);
	}

	var root_5 = template(`<p class="is-size-5 my-3 has-text-info"> </p>`);
	var root_3 = template(`<li><div class="columns is-align-items-center"><div class="column"><!> <div class="column"><h4 class="title has-text-info is-size-4"> </h4> <p class="is-size-6"> </p> <!></div></div></div></li>`);
	var root_6 = template(`<li><div class="column"><h4 class="title has-text-info is-size-4">Shipping Cost</h4> <p class="is-size-5 my-3 has-text-info"> </p></div></li>`);
	var root_2 = template(`<ul><!> <!> <li><div class="column"><hr> <h4 class="title has-text-info is-size-4 mt-5">Order total</h4> <p class="my-3 has-text-info"> </p></div></li></ul>`);
	var root_7 = template(`<ul><li> </li> <li> </li> <li> </li> <li> </li> <li> </li></ul>`);
	var root_9 = template(`<ul><li> </li> <li> </li> <li> </li> <li> </li></ul>`);
	var root_10 = template(`<div class="mt-4"><span> </span> - <span> </span></div>`);
	var root_1 = template(`<div class="columns"><div class="column"><div class="box my-6"><!></div></div> <div class="column px-6"><div class="mt-6"><h2 class="title">Order details</h2> <ul><li> </li> <li> </li></ul> <h2 class="title mt-6">Customer details</h2> <ul><li> </li> <li> </li> <li> </li></ul> <h2 class="title mt-6">Shipping Address</h2> <!></div> <div class="my-6"><h2 class="title pt-2">History</h2> <!></div></div></div>`);
	var root_11 = template(`<div class="sloader-container"><span class="sloader"></span> <h3 class="is-size-5">Please wait</h3></div>`);

	function PreOrder($$anchor, $$props) {
		push($$props, false);

		function formatCurrency(product) {
			return new Intl.NumberFormat("en-IT", {
				style: "currency",
				currency: product.currency,
				maximumFractionDigits: 2
			}).format((product.price || product.amount_total) / 100);
		}

		function displayPaymentMethod(pm) {
			let type = "", wallet = "";

			if (pm.type === "card") {
				type = pm.card;
			}

			if (pm.wallet) {
				let v = "";

				switch (pm.wallet) {
					case "google_pay":
						v = "Google Pay";
						break;
				}
				wallet = v;
			}

			return (wallet ? `(${wallet}) ` : "") + type;
		}

		function calculateTotal(order) {
			let sum = 0;

			for (let product of order.products) {
				sum = sum + product.price;
			}

			if (order.shippingCost) {
				sum = sum + order.shippingCost.amount_total;
			}

			return formatCurrency({
				price: sum,
				currency: order.shippingCost.currency
			});
		}

		async function getOrder() {
			const params = new URLSearchParams(window.location.search);
			const o = await fetch(`/.netlify/functions/getOrder?id=${params.get("id")}`, { method: "GET" }).then((r) => r.json());

			//  order.customer = o.customer;
			return o;
		}

		init();

		var fragment = comment();
		var node = first_child(fragment);

		await_block(
			node,
			getOrder,
			($$anchor) => {
				var div_12 = root_11();

				append($$anchor, div_12);
			},
			($$anchor, order) => {
				var div = root_1();
				var div_1 = child(div);
				var div_2 = child(div_1);
				var node_1 = child(div_2);

				{
					var consequent_3 = ($$anchor) => {
						var ul = root_2();
						var node_2 = child(ul);

						each(node_2, 1, () => get(order).products, index, ($$anchor, product) => {
							var li = root_3();
							var div_3 = child(li);
							var div_4 = child(div_3);
							var node_3 = child(div_4);

							{
								var consequent = ($$anchor) => {
									SirvImage($$anchor, {
										get src() {
											return `https://cdn.kettleblaze.store/orders/${get(product).sku ?? ""}.jpg`;
										},
										width: "480",
										height: "480",
										displayWidth: "120",
										displayHeight: "120",
										quality: "98"
									});
								};

								if_block(node_3, ($$render) => {
									if (get(product).sku !== "prod_AI839Kll1kzw23") $$render(consequent);
								});
							}

							var div_5 = sibling(node_3, 2);
							var h4 = child(div_5);
							var text = child(h4);

							reset(h4);

							var p = sibling(h4, 2);
							var text_1 = child(p, true);

							reset(p);

							var node_4 = sibling(p, 2);

							{
								var consequent_1 = ($$anchor) => {
									var p_1 = root_5();
									var text_2 = child(p_1, true);

									template_effect(() => set_text(text_2, formatCurrency(get(product))));
									reset(p_1);
									append($$anchor, p_1);
								};

								if_block(node_4, ($$render) => {
									if (get(product).price > 0) $$render(consequent_1);
								});
							}

							reset(div_5);
							reset(div_4);
							reset(div_3);
							reset(li);

							template_effect(() => {
								set_text(text, `${get(product).quantity ?? ""} x ${get(product).name ?? ""}`);
								set_text(text_1, get(product).description);
							});

							append($$anchor, li);
						});

						var node_5 = sibling(node_2, 2);

						{
							var consequent_2 = ($$anchor) => {
								var li_1 = root_6();
								var div_6 = child(li_1);
								var p_2 = sibling(child(div_6), 2);
								var text_3 = child(p_2, true);

								template_effect(() => set_text(text_3, formatCurrency(get(order).shippingCost)));
								reset(p_2);
								reset(div_6);
								reset(li_1);
								append($$anchor, li_1);
							};

							if_block(node_5, ($$render) => {
								if (get(order).shippingCost) $$render(consequent_2);
							});
						}

						var li_2 = sibling(node_5, 2);
						var div_7 = child(li_2);
						var p_3 = sibling(child(div_7), 4);
						var text_4 = child(p_3, true);

						template_effect(() => set_text(text_4, calculateTotal(get(order))));
						reset(p_3);
						reset(div_7);
						reset(li_2);
						reset(ul);
						append($$anchor, ul);
					};

					if_block(node_1, ($$render) => {
						if (get(order).products.length > 0) $$render(consequent_3);
					});
				}

				reset(div_2);
				reset(div_1);

				var div_8 = sibling(div_1, 2);
				var div_9 = child(div_8);
				var ul_1 = sibling(child(div_9), 2);
				var li_3 = child(ul_1);
				var text_5 = child(li_3);

				reset(li_3);

				var li_4 = sibling(li_3, 2);
				var text_6 = child(li_4);

				template_effect(() => set_text(text_6, `Payment method: ${displayPaymentMethod(get(order).paymentMethod) ?? ""}`));
				reset(li_4);
				reset(ul_1);

				var ul_2 = sibling(ul_1, 4);
				var li_5 = child(ul_2);
				var text_7 = child(li_5);

				reset(li_5);

				var li_6 = sibling(li_5, 2);
				var text_8 = child(li_6);

				reset(li_6);

				var li_7 = sibling(li_6, 2);
				var text_9 = child(li_7);

				reset(li_7);
				reset(ul_2);

				var node_6 = sibling(ul_2, 4);

				{
					var consequent_4 = ($$anchor) => {
						var ul_3 = root_7();
						var li_8 = child(ul_3);
						var text_10 = child(li_8, true);

						reset(li_8);

						var li_9 = sibling(li_8, 2);
						var text_11 = child(li_9, true);

						reset(li_9);

						var li_10 = sibling(li_9, 2);
						var text_12 = child(li_10, true);

						reset(li_10);

						var li_11 = sibling(li_10, 2);
						var text_13 = child(li_11);

						reset(li_11);

						var li_12 = sibling(li_11, 2);
						var text_14 = child(li_12);

						reset(li_12);
						reset(ul_3);

						template_effect(() => {
							set_text(text_10, get(order).customer.shipping_details.name);
							set_text(text_11, get(order).customer.shipping_details.address.line1);
							set_text(text_12, get(order).customer.shipping_details.address.line2);

							set_text(text_13, `${get(order).customer.shipping_details.address.postal_code ?? ""}
              ${get(order).customer.shipping_details.address.city ?? ""}
              ${(get(order).customer.shipping_details.address.state ? `(${get(order).customer.shipping_details.address.state})` : "") ?? ""}`);

							set_text(text_14, `${get(order).customer.address.country_data.native ?? ""} - ${get(order).customer.address.country ?? ""}`);
						});

						append($$anchor, ul_3);
					};

					var alternate = ($$anchor) => {
						var fragment_2 = comment();
						var node_7 = first_child(fragment_2);

						{
							var consequent_5 = ($$anchor) => {
								var ul_4 = root_9();
								var li_13 = child(ul_4);
								var text_15 = child(li_13, true);

								reset(li_13);

								var li_14 = sibling(li_13, 2);
								var text_16 = child(li_14, true);

								reset(li_14);

								var li_15 = sibling(li_14, 2);
								var text_17 = child(li_15);

								reset(li_15);

								var li_16 = sibling(li_15, 2);
								var text_18 = child(li_16);

								reset(li_16);
								reset(ul_4);

								template_effect(() => {
									set_text(text_15, get(order).customer.address.line1);
									set_text(text_16, get(order).customer.address.line2);

									set_text(text_17, `${get(order).customer.address.postal_code ?? ""}
              ${get(order).customer.address.city ?? ""}
              ${(get(order).customer.address.state ? `(${get(order).customer.address.state})` : "") ?? ""}`);

									set_text(text_18, `${get(order).customer.address.country_data.native ?? ""} - ${get(order).customer.address.country ?? ""}`);
								});

								append($$anchor, ul_4);
							};

							if_block(
								node_7,
								($$render) => {
									if (get(order).customer.address) $$render(consequent_5);
								},
								true
							);
						}

						append($$anchor, fragment_2);
					};

					if_block(node_6, ($$render) => {
						if (get(order).customer.shipping_details) $$render(consequent_4); else $$render(alternate, false);
					});
				}

				reset(div_9);

				var div_10 = sibling(div_9, 2);
				var node_8 = sibling(child(div_10), 2);

				each(node_8, 1, () => get(order).events, index, ($$anchor, event) => {
					var div_11 = root_10();
					var span = child(div_11);
					var text_19 = child(span, true);

					template_effect(() => set_text(text_19, new Date(get(event).ts).toLocaleDateString()));
					reset(span);

					var span_1 = sibling(span, 2);
					var text_20 = child(span_1, true);

					reset(span_1);
					reset(div_11);

					template_effect(() => {
						set_class(span, `has-text-${get(event).level ?? ""}`);
						set_text(text_20, get(event).data.text);
					});

					append($$anchor, div_11);
				});

				reset(div_10);
				reset(div_8);
				reset(div);

				template_effect(() => {
					set_text(text_5, `Id: ${get(order).kettleblazeId ?? ""}`);
					set_text(text_7, `Name: ${get(order).customer.name ?? ""}`);
					set_text(text_8, `Phone: +${get(order).customer.address.country_data.phone[0] ?? ""} ${get(order).customer.phone ?? ""}`);
					set_text(text_9, `Email: ${get(order).customer.email ?? ""}`);
				});

				append($$anchor, div);
			}
		);

		append($$anchor, fragment);
		pop();
	}

	let preOrderApp = mount(PreOrder, {
	  target: document.getElementById("preorder-app"),
	});

	return preOrderApp;

})();
