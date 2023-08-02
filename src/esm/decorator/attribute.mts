/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { MetadataService } from '../internal/core/metadata.service.mjs';
import { Constructable } from '../internal/types.mjs';
import { Optional } from '../utils/optional.mjs';
import { Type } from './type.mjs';

export type AttributeConfig = {
	/** Defines the DynamoDB table column name */
	name?: string;
	/**
	 * Defines to which type the property is mapped to. This applies for read and write operations.
	 *
	 * When using primitve types {@link string}, {@link number} or {@link boolean} this can be omitted.
	 * This is needed if you want to use types like f.e. {@link Set}.
	 */
	type?: Constructable;
	/** Use this attribute as partitionKey value; if 'name' was provided it has to match the DynamoDB partitionKey name. */
	partitionKey?: true | false;
	/** Use this attribute as sortKey value; if 'name' was provided it has to match the DynamoDB sortKey name. */
	sortKey?: true | false;
}

/**
 * Declare a class member as persistent attribute in the DynamoDB table. Only those will be red/written.
 * Only exception are members used in key expressions. Those will be automatically set by the repository.
 *
 * ### Example
 * ```ts
 * Attribute({
 * 	name: 'attribute_1', // column name will be 'attribute_1'
 * 	type: Set, // value will be de-/serialized as Set
 * 	partitionKey: true, // shortcut for using as partitionKey; DynamoDB partitionKey column will be named 'attribute_1'
 * 	sortKey: true // same rule
 * })
 * ```
 * @param config optional configuration
 */
export const Attribute = (config?: AttributeConfig) => (prototype: any, property: string): void => {
	const metadata = MetadataService.getInstance().getMetadata(prototype);

	// always add as attribute
	metadata.createAttribute(property, { name: config?.name });

	// if no config; just abort
	if(!config) {
		return;
	}

	// write attribute type
	const typeDef = Optional.of(config.type);
	typeDef.ifPresent(t => Type(t)(prototype, property));

	// check if used as partitionKey
	if(config.partitionKey) {
		// set expression
		const pkDef = metadata.getPartitionKey();
		pkDef.expression =  `{{${property}}}`;
		pkDef.templateAttributes = new Set([property]);

		// update table key mapping
		pkDef.name = config.name ?? property;
		typeDef.ifPresent(t => pkDef.type = t as StringConstructor | NumberConstructor);
	}

	// check if used as sortKey
	if(config.sortKey) {
		// set expression
		// update table key mapping (always present at this point - can only be deleted by @Item)
		metadata.setSortKey({
			expression: `{{${property}}}`,
			name: config.name ?? property,
			type: typeDef.orElse(String) as StringConstructor | NumberConstructor,
			templateAttributes: new Set([property])
		});
	}
};
