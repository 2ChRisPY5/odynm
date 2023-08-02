import { ConditionFunc, Constructable, QuerySpecification, UpdateSpecification } from '../internal/types.mjs';
import { Optional } from '../utils/optional.mjs';

export type IndexConfig = {
	index?: string;
}
export type QueryConfig = IndexConfig & { sortKeyComparator: ConditionFunc };

/**
 * Interface for performing basic DynamoDB CRUD operations.
 */
export interface Repository<T extends Constructable> {
	/**
	 * Get one item for the specified key. Only the properties used as key or in a key expression must be set. All others will be ignored.
	 *
	 * @param key the partial item for building the DynamoDB key
	 * @return the optional found item
	 */
	readonly get: (key: Partial<InstanceType<T>>) => Promise<Optional<InstanceType<T>>>;

	/**
	 * Get multiple items for the specified keys. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param keys an array of partial items for building the DynamoDB keys
	 * @return array of items (empty array if nothing was found)
	 */
	readonly getMany: (...keys: Partial<InstanceType<T>>[]) => Promise<InstanceType<T>[]>;

	/**
	 * Put the given item. Item will be overwritten.
	 *
	 * @param item the item to save
	 */
	readonly put: (item: InstanceType<T>) => Promise<void>;

	/**
	 * Put all the given items. Items will be overwritten.
	 *
	 * @param items array if items to put
	 */
	readonly putAll: (...items: InstanceType<T>[]) => Promise<void>;

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
	readonly query: (specification: QuerySpecification<InstanceType<T>>, config?: QueryConfig) => Promise<InstanceType<T>[]>;

	/**
	 * Scan for items matching the given specification. Passing nothing or empty object will scan for all items.
	 *
	 * DynamoDB table will be scannend recursively until no more ExclusiveStartKey is left.
	 *
	 * @param specification the scan specification
	 * @param config optional configuration; can set an index used for scanning
	 */
	readonly scan: (specification?: QuerySpecification<InstanceType<T>>, config?: IndexConfig) => Promise<InstanceType<T>[]>;

	/**
	 * Delete the item matching the specified key. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param key the partial item for building the DynamoDB key
	 */
	readonly delete: (key: Partial<InstanceType<T>>) => Promise<void>;

	/**
	 * Delete the items matching the specified keys. Only the properties used as key or in a key expression must be set.
	 * All others will be ignored.
	 *
	 * @param keys the partial items for building the DynamoDB key
	 */
	readonly deleteAll: (...keys: Partial<InstanceType<T>>[]) => Promise<void>;

	/**
	 * Specify partially for an item what and how attributes are getting updated. If a class instance is passed the same instance will
	 * be returned. In case of an object-literal a newly created instance with the merged state will be returned.
	 *
	 * @param spec the update specification; you can either supply plain values or one of the following update functions
	 * 				(increment, decrement, appendList, remove, addSet and deleteSet)
	 * @return the updated item
	 */
	readonly update: (spec: UpdateSpecification<InstanceType<T>>) => Promise<InstanceType<T>>;

	/**
	 * Specify partially for all items what and how attributes are getting updated.
	 *
	 * @param spec the update specifications
	 * @return array of updated items
	 */
	readonly updateAll: (...specs: UpdateSpecification<InstanceType<T>>[]) => Promise<InstanceType<T>[]>;
}
