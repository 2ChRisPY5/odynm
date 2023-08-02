import { Optional } from '../utils/optional.mjs';
import { KeyDef } from './metadata.mjs';

// start-pattern | between-pattern | end-pattern
// @internal
export const STATIC_PARTS = /(^[^{]+?(?={{))|((?<=}}).+(?={{))|((?<=}}).+(?<!}})$)/g;
// @internal
export const TEMPLATES = /\{{2}(\w+?)\}{2}/g;

// @internal
export const mergeTemplates = (pk: KeyDef, sk: Optional<KeyDef>) => {
	const templates = new Set(pk.templateAttributes);
	sk.map(s => [...s.templateAttributes.values()]).ifPresent(tas => tas.forEach(ta => templates.add(ta)));

	return templates;
};

/**
 * Partition the given items und multiple arrays of given size.
 *
 * @param size the size of each partition
 * @param items all items
 * @returns the partitioned items
 * @internal
 */
export const partition = <T extends Record<string, unknown>> (size: number, ...items: T[]): T[][] => {
	if(!items.length) {
		return [];
	}

	const partitioned: T[][] = [];
	const iterations = items.length / size | 0;

	// iterate partitions
	for (let iter = 0; iter < iterations; iter++) {
		partitioned.push(items.slice(iter * size, (iter + 1) * size));
	}

	// add remaining
	if(items.length % size) {
		partitioned.push(items.slice(iterations * size));
	}

	return partitioned;
};

/**
 * Group the given items by given key mapping function.
 *
 * @param keyMap function for mapping the key
 * @param items all items
 * @returns the grouped items
 * @internal
 */
export const groupBy = <K, T> (keyMap: (item: T) => K, ...items: T[]): Map<K, T[]> =>
	items.reduce((map, it) => {
		// initialize key-value if not present
		const key = keyMap(it);
		if(!map.has(key)) {
			map.set(key, []);
		}

		// push items
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		map.get(key)!.push(it);

		return map;
	}, new Map<K, T[]>());
