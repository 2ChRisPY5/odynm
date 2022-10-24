import { ConditionFunc, Constructable, Specification } from '../internal/types.mjs';
import { Optional } from '../utils/optional.mjs';

export type IndexConfig = {
	index?: string;
}
export type QueryConfig = IndexConfig & { sortKeyComparator: ConditionFunc };

/**
 * Interface for performing basic DynamoDB CRUD operations.
 */
export interface Repository<T extends InstanceType<Constructable>> {
	/**
	 * Get one item for the specified key. Only the properties used as key or in a key expression must be set. All others will be ignored.
	 *
	 * @param key the partial item for building the DynamoDB key
	 * @return the optional found item
	 */
	readonly get: (key: Partial<T>) => Promise<Optional<T>>;

	/**
	 * Get multiple items for the specified keys. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param keys an array of partial items for building the DynamoDB keys
	 * @return array of items (empty array if nothing was found)
	 */
	readonly getMany: (...keys: Partial<T>[]) => Promise<T[]>;

	/**
	 * Put the given item. Item will be overwritten.
	 *
	 * @param item the item to save
	 */
	readonly put: (item: T) => Promise<void>;

	/**
	 * Put all the given items. Items will be overwritten.
	 *
	 * @param items array if items to put
	 */
	readonly putAll: (...items: T[]) => Promise<void>;

	/**
	 * Query for items matching the given specification. Properties used in/as key must be provided as plain values.
	 *
	 * Optionally you can provide an index to query and a comparator for sort-key evaluation. If none was specified 'beginsWith()'
	 * will be used. Only allowed functions are: equal, lessThan, lassThanOrEqual, greaterThan, greaterThanOrEqual and beginsWith.
	 *
	 * DynamoDB table will be queried recursively until no more ExclusiveStartKey is left.
	 *
	 * @param specification the query specification
	 * @param config optional configuration
	 */
	readonly query: (specification: Specification<T>, config?: QueryConfig) => Promise<T[]>;

	/**
	 * Scan for items matching the given specification. Passing nothing or empty object will scan for all items.
	 *
	 * DynamoDB table will be scannend recursively until no more ExclusiveStartKey is left.
	 *
	 * @param specification the scan specification
	 * @param config optional configuration; can set an index used for scanning
	 */
	readonly scan: (specification?: Specification<T>, config?: IndexConfig) => Promise<T[]>;

	/**
	 * Delete the item matching the specified key. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param key the partial item for building the DynamoDB key
	 */
	readonly delete: (key: Partial<T>) => Promise<void>;

	/**
	 * Delete the items matching the specified keys. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param keys the partial items for building the DynamoDB key
	 */
	readonly deleteAll: (...keys: Partial<T>[]) => Promise<void>;

	/**
	 * Update the given item partially.
	 *
	 * @param item the item to update
	 */
	readonly update: (item: T) => Promise<void>;

	/**
	 * Update all given items partially
	 *
	 * @param item the items to update
	 */
	readonly updateAll: (...items: T[]) => Promise<void>;
}
