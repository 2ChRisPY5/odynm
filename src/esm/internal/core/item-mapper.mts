/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { KeyDefinition } from '../../core/types.mjs';
import { Optional } from '../../utils/optional.mjs';
import { KeyDef, Metadata } from '../metadata.mjs';
import { Constructable } from '../types.mjs';
import { MetadataService } from './metadata.service.mjs';
import { mergeTemplates, STATIC_PARTS, TEMPLATES } from '../utils.mjs';

/**
 * Implementation for mapping DynamoDB result to type and vice-versa.
 * @internal
 */
export class ItemMapper<T extends Constructable> {
	// metadata
	private readonly metadata: Metadata;

	constructor(private readonly type: T) {
		this.metadata = MetadataService.getInstance().getMetadata(type.prototype);
	}

	/**
	 * Serialize the item to its' DynamoDB item representation.
	 *
	 * @param value the item
	 * @returns the serialized DynamoDB item
	 */
	readonly serialize = (value: InstanceType<T> | Partial<T>): Record<string, unknown> => {
		// initialize with partition key
		const pk = this.metadata.getPartitionKey();
		const converted: Record<string, unknown> = {
			[pk.name]: this.substituteKey(value, pk)
		};

		// check if sortKey is configured
		this.metadata.getSortKey().ifPresent(sk => converted[sk.name] = this.substituteKey(value, sk));

		// write attributes to object
		this.metadata.getAttributes().forEach(attr => {
			const config = this.metadata.getAttribute(attr).get();

			Optional.of((value as any)[attr])
				.map(plainVal => Optional.of(config.type)
					.map(constr => new constr(plainVal).valueOf())
					.orElse(plainVal))
				.ifPresent(val => converted[config.name ?? attr] = val);
		});

		return converted;
	};

	/**
	 * Deserialize a DynamoDB item to its' mapped class.
	 *
	 * @param value the DynamoDB item
	 * @returns the instantiated class
	 */
	readonly deserialize = (value: Record<string, unknown>, pk?: KeyDef, sk?: Optional<KeyDef>): T => {
		const created = new this.type() as any;

		// parse partitionKey
		const pkDef = pk ?? this.metadata.getPartitionKey();
		this.deserializeKey(pkDef, value, created);

		// parse sortKey
		const skDef = sk ?? this.metadata.getSortKey();
		skDef.ifPresent(def => this.deserializeKey(def, value, created));

		// get templates
		const templates = mergeTemplates(pkDef, skDef);

		// write attributes to class
		this.metadata.getAttributes()
			// only attributes not used in key
			.filter(attr => !templates.has(attr))
			.forEach(attr => {
				const config = this.metadata.getAttribute(attr).get();

				Optional.of(value[config.name ?? attr])
					.map(plainVal => Optional.of(config.type)
						.map(constr => new constr(plainVal).valueOf() as unknown)
						.orElse(plainVal))
					.ifPresent(val => created[attr] = val);
			});

		this.metadata.getHooks('postLoad')
			.map(hook => Optional.of(created[hook]))
			.forEach(hook => hook.ifPresent(fn => fn()));
		return created;
	};

	/**
	 * Substitute the key template with values from given object.
	 *
	 * @param value the instantiated item class
	 * @param mapping the mapping for the key
	 * @returns the substituted key value
	 */
	public readonly substituteKey = (value: any, mapping: KeyDef) => {
		const replaced = [...mapping.expression!.matchAll(TEMPLATES)]
			.reduce((prev, curr) => prev.replace(curr[0], `${value[curr[1]]}`), mapping.expression!);

		return new mapping.type(replaced).valueOf();
	};

	/**
	 * Parses the given key, extracts its' template values and assigns them to the created instance.
	 *
	 * @param mapping the key definition for the partition or sort key
	 * @param expression the used expression for the key
	 * @param value the DynamoDB item
	 * @param created the newly created instance
	 */
	private readonly deserializeKey = (mapping: KeyDef, value: Record<string, unknown>, created: any) => {
		// get information
		const pk = value[mapping.name] as string | number;
		const staticParts = [...mapping.expression!.matchAll(STATIC_PARTS)];

		// if no static parts
		if(typeof pk === 'number' || !staticParts.length) {
			const prop = nameFromTemplate(mapping.expression!);
			created[prop] = this.keyPropertyValue(mapping, prop, pk);
			return;
		}

		// special case if first part is not at start
		const first = staticParts[0];
		if(first.index! > 0) {
			const prop = nameFromTemplate(mapping.expression!.substring(0, first.index));
			created[prop] = this.keyPropertyValue(mapping, prop, pk.substring(0, pk.indexOf(first[0])));
		}

		// iterate through static parts
		staticParts.forEach((match, idx, result) => {
			// if another static exists; the current end must be set to the starting index of next match
			let valueEnd: number | undefined;
			let templateEnd: number | undefined;
			if(idx < result.length - 1) {
				valueEnd = pk.indexOf(result[idx + 1][0]);
				templateEnd = result[idx + 1].index;
			}

			const staticText = match[0];
			// get the property name from template
			const prop = nameFromTemplate(mapping.expression!.substring(match.index! + staticText.length, templateEnd));
			// extract the value from the key value and set it
			created[prop] = this.keyPropertyValue(mapping, prop, pk.substring(pk.indexOf(staticText) + staticText.length, valueEnd));
		});
	};

	/**
	 * Get the correctly typed value for a property used as key template.
	 *
	 * @param mapping the key definition for the partition or sort key
	 * @param property the property name in the actual class
	 * @param value the extracted value
	 * @returns correctly typed value
	 */
	private readonly keyPropertyValue = (mapping: KeyDefinition, property: string, value: number | string) =>
		new (this.metadata.getType(property)
			.orElse(mapping.type))(value)
			.valueOf();
}

/**
 * Extract the property name from the template.
 *
 * @param template the complete template string
 * @returns the embedded property name
 * @internal
 */
const nameFromTemplate = (template: string) => template.substring(2, template.length - 2);
