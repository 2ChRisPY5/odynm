/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Constructable } from '../internal/types.mjs';
import { KeyDefinition, Table } from '../core/types.mjs';
import { Optional } from '../utils/optional.mjs';
import { MetadataService } from '../internal/core/metadata.service.mjs';
import { KeyDef, Metadata } from '../internal/metadata.mjs';

export type ItemConfig = {
	/**
	 * Defines the DynamoDB table name or complex configuration.
	 * @see Table
	 */
	readonly table: string | Table;
	/**
	 * Defines the expressions for partition/sort key. This can be omitted but must then be provided using \@{@link Attribute} decorator.
	 */
	readonly key?: {
		readonly partitionKey: string;
		readonly sortKey?: string;
	};
	/**
	 * Defines the alternativ key expressions for LSIs. The index name must match the ones in the table definition.
	 */
	readonly lsi?: Record<string, string>;
	/**
	 * Defines the alternative key expressions for GSIs. The index name must match the ones in the table definition.
	 */
	readonly gsi?: Record<string, {
		readonly partitionKey: string;
		readonly sortKey?: string;
	}>;
}

/**
 * Defines a class to be used with ODynM.
 *
 * #### Example 1
 * The column names in DynamoDB table for partitionKey and sortKey must be 'pk' and 'sk' respectively.
 * Both types will bve treated as {@link String}. The expressions for partition/sort key must be provided using \@{@link Attribute}
 * decorator.
 * ```ts
 * Item({
 * 	table: 'table'
 * })
 * ```
 *
 * #### Example 2
 * The column names in DynamoDB table for partitionKey and sortKey must be 'pk' and 'sk' respectively.
 * Both types will bve treated as {@link String}.
 *
 * partitionKey will be built from the static part and the substituted value from 'id' member. For example: SOME#1234
 *
 * sortKey is not used.
 *
 * This configuration takes always precedence over \@{@link Attribute} decorator.
 * ```ts
 * Item({
 *		table: 'table',
 *		key: { partitionKey: 'SOME#{{id}}' }
 * })
 * ```
 *
 * #### Example 3
 * The column names in DynamoDB table for partitionKey and sortKey must be 'partition' and 'sort' respectively.
 * The type for partitionKey will default to {@link string}. sortKey will be treated as {@link number}.
 *
 * partitionKey will be built from the static part and the substituted value from 'id' member. For example: SOME#1234
 *
 * sortKey will evaluate to 12345.
 *
 * This configuration takes always precedence over \@{@link Attribute} decorator.
 *
 * ```ts
 * Item({
 * 	table: {
 * 		name: 'table',
 * 		partitionKey: 'partition',
 * 		sortKey: { name: 'sort', type: Number }
 * 	},
 * 	key: { partitionKey: 'SOME#{{id}}', sortKey: '{{id}}' }
 * })
 * ```
 *
 * @param config the configuration of the item
 */
export const Item = (config: ItemConfig) => (constr: Constructable): void => {
	const service = MetadataService.getInstance();
	const metadata = service.getMetadata(constr.prototype);

	updateTableDefinition(metadata, config);

	// update key expressions
	Optional.of(config.key).ifPresent(key => {
		metadata.getPartitionKey().expression = key.partitionKey;
		metadata.getSortKey().ifPresent(sk => sk.expression = key.sortKey);
	});

	// LSIs and GSIs
	const table = config.table;
	const lsi = Optional.of(config.lsi);
	const gsi = Optional.of(config.gsi);
	validateIndexes(constr.name, [lsi, gsi].map(idx => idx.map(Object.keys).orElse([])).flat(), table);

	// write LSIs
	lsi.map(conf => Object.entries(conf)).ifPresent(idxs => {
		const tableLsi = (table as Table).lsi!;
		idxs.forEach(idx => {
			const name = idx[0];
			metadata.setLSI(name, { ...keyDefOrDefault(tableLsi[name]), expression: idx[1] });
		});
	});

	// write GSIs
	gsi.map(conf => Object.entries(conf)).ifPresent(idxs => {
		const tableGsi = (table as Table).gsi!;
		idxs.forEach(idx => {
			const name = idx[0];
			const tableConfig = tableGsi[name];
			metadata.setGSI(name, { ...keyDefOrDefault(tableConfig.partitionKey), expression: idx[1].partitionKey },
				Optional.of(tableConfig.sortKey)
					.map(conf => {
						return {  ...keyDefOrDefault(conf), expression: idx[1].sortKey };
					})
					.elseUndefined());
		});
	});

	service.validate(constr);
};

/**
 * Update table metadata.
 *
 * @param metadata the metadata object
 * @param config the class configuration
 */
const updateTableDefinition = (metadata: Metadata, config: ItemConfig) => {
	const table = config.table;

	if(typeof table === 'object') {
		metadata.setTable(table.name);

		// set partition key
		Optional.of(table.partitionKey)
			.map(pk => keyDefOrDefault(pk))
			.ifPresent(pk => Object.assign(metadata.getPartitionKey(), pk));

		// set partition key
		const sortKey = Optional.of(table.sortKey)
			.map(sk => keyDefOrDefault(sk));
		sortKey.ifPresent(metadata.setSortKey);
		sortKey.ifNotPresent(metadata.setSortKey);
	} else {
		metadata.setTable(table);
	}
};

/**
 * Validate the consistency of the index names.
 *
 * @param item the item name
 * @param indexes the named indexes
 * @param table the table definition
 */
const validateIndexes = (item: string, indexes: string[], table: string | Table) => {
	if(indexes.length && typeof table !== 'object') {
		throw new Error(`There are indexes defined on item ${item} but table definition does not.`);
	}

	// gather table indexes
	const tt = table as Table;
	const configured: string[] = [];
	Optional.of(tt.lsi).map(Object.keys).ifPresent(vals => configured.push(...vals));
	Optional.of(tt.gsi).map(Object.keys).ifPresent(vals => configured.push(...vals));

	// gather missing
	const missing = indexes.filter(idx => configured.indexOf(idx) < 0);
	if(missing.length) {
		throw new Error(`Following indexes are configured in ${item} but are not in table definition: ${missing.join(', ')}`);
	}
};

// little helper
const keyDefOrDefault = (key: string | KeyDefinition): KeyDef => {
	const templateAttributes = new Set<string>();
	return typeof key === 'object'
		? { ...key, templateAttributes }
		: {
			name: key, type: String, templateAttributes
		};
};
