import { ConditionBuilder } from '../internal/condition.builder.mjs';
import { UpdateBuilder } from '../internal/update.builder.mjs';

/**
 * Used when configuring partition/sort key of table in {@link Item}.
 * @see Table
 */
export type KeyDefinition = {
	/** Defines the column name in DynamoDB table */
	name: string;
	/** Either {@link String} or {@link Number} */
	type: StringConstructor | NumberConstructor;
}

/**
 * Configuration of a DynamoDB table.
 *
 * #### Example
 * ```ts
 * {
 * 	name: 'table1', // name of the DynamoDB table
 * 	partitionKey: 'partition', // DynamoDB partitionKey name is 'partition'; default type is string
 * 	sortKey: { name: 'sort', type: Number } // DynamoDB sortKey name is 'sort'; will be de-/serialized as number
 * }
 * ```
 */
export type Table = {
	/** Defines the name of the DynamoDB table */
	readonly name: string;
	/**
	 * Defines the name of the primaryKey column of the DynamoDB table.
	 *
	 * Optional: You can define if the type should be {@link string} or {@link number}. If omitted {@link string} will be the default.
	 */
	readonly partitionKey: string | KeyDefinition;
	/**
	 * Defines the name of the sortKey column of the DynamoDB table.
	 *
	 * Optional: You can define if the type should be {@link string} or {@link number}. If omitted {@link string} will be the default.
	 */
	readonly sortKey?: string | KeyDefinition;

	/**
	 * Define the LSIs configured on this table. Object key need to match the name of the DynamoDB LSI.
	 */
	readonly lsi?: Record<string, string | KeyDefinition>;

	/**
	 * Define the GSIs configured on this table. Object key need to match the name of the DynamoDB GSI.
	 */
	readonly gsi?: Record<string, {
		partitionKey: string | KeyDefinition,
		sortKey?: string | KeyDefinition
	}>;
}

export type Comparator = '=' | '<>' | '<' | '<=' | '>' | '>=';
export type Value = string | number | boolean | null;
export type ConditionBuilderFunc = (builder: ConditionBuilder) => void;
export type UpdateBuilderFn = (builder: UpdateBuilder) => void;
export type ConditionFunc = (value: Value) => ConditionBuilderFunc;

// construct a type of all properties which can also have a condition builder function
export type QuerySpecification<T> = {
	[K in keyof T]?: T[K] | ConditionBuilderFunc;
}

// construct a type of all properties which can also have a update builder function
export type UpdateSpecification<T> = {
	[K in keyof T]?: T[K] | UpdateBuilderFn;
};
