/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { KeyDefinition } from '../core/types.mjs';
import { Optional } from '../utils/optional.mjs';
import { Constructable } from './types.mjs';
import { TEMPLATES } from './utils.mjs';

// @internal
type AttributeConfig = { name?: string };
// @internal
export type Attribute = AttributeConfig & { type?: Constructable };
// @internal
export type KeyDef = KeyDefinition & { expression?: string, templateAttributes: Set<string> };

/**
 * Metadata implementation
 * @internal
 */
export class Metadata {
	private table?: string;

	// key configuration
	private readonly partitionKey: KeyDef = {
		name: 'pk',
		type: String,
		templateAttributes: new Set()
	};
	private sortKey?: KeyDef = {
		name: 'sk',
		type: String,
		templateAttributes: new Set()
	};

	// the LSIs and GSIs
	private readonly lsi: Record<string, KeyDef> = {};
	private readonly gsi: Record<string, { partitionKey: KeyDef, sortKey?: KeyDef }> = {};

	// attributes
	private readonly attributes: Record<string, AttributeConfig> = {};

	// type definitions
	private readonly types: Record<string, Constructable> = {};

	/**
	 * Get the table name
	 */
	readonly getTable = () => this.table!;

	/**
	 * Set the table name.
	 *
	 * @param table the table name
	 */
	readonly setTable = (table: string) => this.table = table;

	/**
	 * Get the partitionKey config
	 */
	readonly getPartitionKey = () => this.partitionKey;

	/**
	 * Get the optional sortKey config
	 */
	readonly getSortKey = () => Optional.of(this.sortKey);

	/**
	 * Set (or unset) the sort key definition.
	 *
	 * @param def the optional definition
	 */
	readonly setSortKey = (def?: KeyDef) => this.sortKey = def;

	/**
	 * Sets the key definition for a LSI.
	 *
	 * @param name the name of the index
	 * @param sortKey the sort key definition
	 */
	readonly setLSI = (name: string, sortKey: KeyDef) => this.lsi[name] = sortKey;

	/**
	 * Sets the key definitions for a GSI.
	 *
	 * @param name the name of the index
	 * @param partitionKey the partitionKey definition
	 * @param sortKey the optional sortKey definition
	 */
	readonly setGSI = (name: string, partitionKey: KeyDef, sortKey?: KeyDef) => this.gsi[name] = { partitionKey, sortKey };

	/**
	 * Get the partitionKey definition for given index.
	 *
	 * @param name the name of the index
	 * @returns the partitionKey definition
	 */
	readonly getIndexPk = (name: string) => Optional.of(this.gsi[name])
		.map(def => def.partitionKey)
		.or(() => Optional.of(this.lsi[name])
			.map(() => this.partitionKey))
		.elseThrow(() => new Error(`Index ${name} is not defined`));

	/**
	 * Get the optional sortKey definition for given index.
	 *
	 * @param name the name of the index
	 * @returns the optional sortKey definition
	 */
	readonly getIndexSk = (name: string) => Optional.of(this.gsi[name])
		.map(def => def.sortKey)
		.or(() => Optional.of(this.lsi[name]));

	/**
	 * Get the attribute names
	 */
	readonly getAttributes = () => Object.keys(this.attributes);

	/**
	 * Get the attribute configuration.
	 *
	 * @param attr the attribute name
	 */
	readonly getAttribute = (attr: string) => Optional.of<Attribute>(this.attributes[attr])
		.map(conf => {
			return { ...conf, type: this.getType(attr).elseUndefined() };
		});

	/**
	 * Create a configuration for an attribute.
	 *
	 * @param attr the attribute name
	 * @param conf the configuration
	 */
	readonly createAttribute = (attr: string, conf: AttributeConfig) => this.attributes[attr] = conf;

	/**
	 * Set the type for attribute.
	 *
	 * @param attr the attribute name
	 * @param type the type to use
	 */
	readonly setType = (attr: string, type: Constructable) => this.types[attr] = type;

	/**
	 * Get the type configuration for an attribute.
	 *
	 * @param attr the attribute name
	 */
	readonly getType = (attr: string) => Optional.of(this.types[attr]);

	/**
	 * Clone this metadata instance.
	 */
	readonly clone = () => {
		const cloned = new Metadata();
		cloned.table = this.table;
		Object.assign(cloned.partitionKey, this.partitionKey);
		cloned.sortKey = Optional.of(this.sortKey)
			.map(sk => {
				return { ...sk };
			}).elseUndefined();
		Object.entries(this.attributes).forEach(attr => cloned.attributes[attr[0]] = { ...attr[1] });
		Object.assign(cloned.types, this.types);

		return cloned;
	};

	/**
	 * Finalize the metadata
	 */
	readonly finalize = () => {
		setTemplateAttributes(this.partitionKey);
		Optional.of(this.sortKey).ifPresent(setTemplateAttributes);
		Optional.of(this.lsi).map(_ => Object.values(_)).ifPresent(keys => keys.forEach(k => setTemplateAttributes(k)));
		Optional.of(this.gsi).map(_ => Object.values(_)).ifPresent(keys => keys.forEach(k => {
			setTemplateAttributes(k.partitionKey);
			Optional.of(k.sortKey).ifPresent(setTemplateAttributes);
		}));

		Object.seal(this);
	};
}

// @internal
const setTemplateAttributes = (keyDef: KeyDef) =>
	keyDef.templateAttributes = new Set([...keyDef.expression!.matchAll(TEMPLATES)].map(m => m[1]));
