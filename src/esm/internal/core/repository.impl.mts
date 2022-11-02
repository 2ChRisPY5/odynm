/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BatchGetCommand, BatchWriteCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand,
	QueryCommand, QueryCommandInput, ScanCommand, ScanCommandInput, UpdateCommand, UpdateCommandInput} from '@aws-sdk/lib-dynamodb';
import { beginsWith, contains, equal } from '../../core/conditions.mjs';
import { IndexConfig, QueryConfig, Repository } from '../../core/repository.mjs';
import { Optional } from '../../utils/optional.mjs';
import { ConditionBuilder } from '../condition.builder.mjs';
import { KeyDef, Metadata } from '../metadata.mjs';
import { ConditionBuilderFunc, ConditionFunc, Constructable, QuerySpecification, Value, UpdateSpecification,
	UpdateBuilderFn } from '../types.mjs';
import { UpdateBuilder } from '../update.builder.mjs';
import { mergeTemplates, partition, TEMPLATES } from '../utils.mjs';
import { ItemMapper } from './item-mapper.mjs';
import { MetadataService } from './metadata.service.mjs';

// @internal
type NativeSpec = Record<string, Value | ConditionBuilderFunc>;
// @internal
type BatchWriteRequest = { PutRequest?: { Item: any }, DeleteRequest?: { Key: any }};

/**
 * Repository implementation
 * @internal
 */
export class RepositoryImpl<T extends Constructable> implements Repository<T> {
	private readonly keyAttributes: Set<string>;
	private readonly templateAttributes: Set<string>;
	private readonly mapper: ItemMapper<T>;
	private readonly metadata: Metadata;

	constructor(private readonly type: T, private readonly client: DynamoDBDocumentClient) {
		this.metadata = MetadataService.getInstance().getMetadata(type.prototype);
		this.mapper = new ItemMapper(type);

		const pk = this.metadata.getPartitionKey();
		const skDef = this.metadata.getSortKey();

		// get attributes which are part of key
		this.templateAttributes = mergeTemplates(pk, skDef);

		// determine the key attribute names of table
		this.keyAttributes = new Set([pk.name]);
		skDef.map(sk => sk.name).ifPresent(sk => this.keyAttributes.add(sk));
	}

	/**
	 * @see Repository#get
	 */
	readonly get = async (key: Partial<InstanceType<T>>) => this.client.send(new GetCommand({
		TableName: this.metadata.getTable(),
		Key: this.buildGetKey(key)
	})).then(out => Optional.of(out.Item).map(this.mapper.deserialize));

	/**
	 * @see Repository#getMany
	 */
	readonly getMany = async (...keys: Partial<InstanceType<T>>[]) => {
		// just abort
		if(!keys.length) {
			return [];
		}

		return Promise.all(partition(100, ...keys.map(k => this.buildGetKey(k)))
			.map(batch => this.resolveKeys(batch)))
			.then(result => result.flat().map(r => this.mapper.deserialize(r)));
	};

	/**
	 * @see Repository#put
	 */
	readonly put = async (item: InstanceType<T>) => {
		const instance = this.toClassInstance(item);

		applyHooks(this.metadata.getHooks('prePut'), instance);
		await this.client.send(new PutCommand({
			TableName: this.metadata.getTable(),
			Item: this.mapper.serialize(instance)
		}));
	};

	/**
	 * @see Repository#putAll
	 */
	readonly putAll = async (...items: InstanceType<T>[]) => {
		// just abort if nothing provided
		if(!items.length) {
			return;
		}
		const instances = items.map(it => this.toClassInstance(it));

		applyHooks(this.metadata.getHooks('prePut'), ...instances);
		await Promise.all(partition(25, ...instances.map(it => this.mapper.serialize(it)))
			.map(batch => this.batchItems(batch, Item => {
				return { PutRequest: { Item } };
			}, result => result.PutRequest!.Item)));
	};

	/**
	 * @see Repository#query
	 */
	readonly query = async (spec: QuerySpecification<InstanceType<T>>, config: QueryConfig = { sortKeyComparator: beginsWith }) => {
		const index = Optional.of(config.index);

		// add partitionKey check
		const keyCondition = new ConditionBuilder();
		const pk = index.map(this.metadata.getIndexPk)
			.orElseGet(this.metadata.getPartitionKey);
		keyCondition.addExpressionName(pk.name);
		equal(this.mapper.substituteKey(spec, pk))(keyCondition);

		// add sortKey check
		const sk = index.flatMap(this.metadata.getIndexSk)
			.or(this.metadata.getSortKey);
		sk.flatMap(val => this.substituteSk(spec, val))
			.ifPresent(val => {
				keyCondition.nextIndex();
				keyCondition.addExpressionName(sk.get().name);
				config.sortKeyComparator(val)(keyCondition);
			});


		// add attributes as filter expression
		const attributeCondition = new ConditionBuilder(keyCondition.index);
		this.getAttributeFilter(spec as NativeSpec, attributeCondition, mergeTemplates(pk, sk));

		// build the input and run it
		return this.queryRecursive({
			TableName: this.metadata.getTable(),
			IndexName: config.index,
			KeyConditionExpression: keyCondition.fullCondition,
			FilterExpression: attributeCondition.fullCondition,
			...keyCondition.getMergedExpressions(attributeCondition)
		}, pk, sk);
	};

	/**
	 * @see Repository#scan
	 */
	readonly scan = async (spec: QuerySpecification<InstanceType<T>> = {}, config: IndexConfig = {}) => {
		const builder = new ConditionBuilder(-1);
		const index = Optional.of(config.index);

		// partitionKey
		const pk = index.map(this.metadata.getIndexPk)
			.orElseGet(this.metadata.getPartitionKey);
		this.buildScanKeyFilter(pk, spec as NativeSpec, builder);

		// sortKey
		const sk = index.flatMap(this.metadata.getIndexSk)
			.or(this.metadata.getSortKey);
		sk.ifPresent(sk => this.buildScanKeyFilter(sk, spec as NativeSpec, builder));

		// add attributes as filter expression
		this.getAttributeFilter(spec as NativeSpec, builder, mergeTemplates(pk, sk));

		return this.scanRecursive({
			TableName: this.metadata.getTable(),
			IndexName: config.index,
			FilterExpression: builder.fullCondition,
			...builder.partialInput
		}, pk, sk);
	};

	/**
	 * @see Repository#delete
	 */
	readonly delete = async (key: Partial<InstanceType<T>>) => {
		await this.client.send(new DeleteCommand({
			TableName: this.metadata.getTable(),
			Key: this.buildGetKey(key)
		}));
	};

	/**
	 * @see Repository#deleteAll
	 */
	readonly deleteAll = async (...keys: Partial<InstanceType<T>>[]) => {
		if(!keys.length) {
			return;
		}

		await Promise.all(partition(25, ...keys.map(it => this.buildGetKey(it)))
			.map(batch => this.batchItems(batch, Key => {
				return { DeleteRequest: { Key } };
			}, result => result.DeleteRequest!.Key)));
	};

	/**
	 * @see Repository#update
	 */
	readonly update = async (spec: UpdateSpecification<InstanceType<T>>) => {
		// separate plain values from functions
		let instance: any;
		const functions: Record<string, UpdateBuilderFn> = {};

		// if object literal; iterate attributes and split properties by type
		const isLiteral = Object.getPrototypeOf(spec) === Object.prototype;
		if(isLiteral) {
			instance = new this.type();

			Object.entries(spec).forEach(attr => {
				if(typeof attr[1] === 'function') {
					functions[attr[0]] = attr[1] as UpdateBuilderFn;
				} else {
					instance[attr[0]] = attr[1];
				}
			});
		} else {
			instance = spec;
		}

		// apply hooks to instance
		applyHooks(this.metadata.getHooks('preUpdate'), instance);

		// iterate attributes
		const builder = new UpdateBuilder();
		this.metadata.getAttributes().forEach(attr => {
			const config = this.metadata.getAttribute(attr).get();

			// custom function has always priority
			const fn = Optional.of(functions[attr]);
			fn.ifPresent(updateFn => {
				builder.addAttribute(config.name ?? attr);
				updateFn(builder);
			});

			// else take plain value
			fn.ifNotPresent(() => {
				Optional.of(instance[attr])
					.map(val => Optional.of(config.type)
						.map(t => new t(val))
						.orElse(val))
					.ifPresent(val => {
						builder.addAttribute(config.name ?? attr);
						builder.addValue(val);
						builder.addSet(`${builder.attributeExpression} = ${builder.valueExpression}`);
					});
			});

			builder.nextIndex();
		});

		// send command
		const { Attributes } = await this.client.send(new UpdateCommand({
			TableName: this.metadata.getTable(),
			Key: this.buildGetKey(instance),
			...builder.build()
		}));

		// deserialize update and return merged state
		const converted = this.mapper.deserialize(Attributes!);
		return Object.assign(instance, converted);
	};

	/**
	 * @see Repository#updateAll
	 */
	readonly updateAll = async (...specs: UpdateSpecification<InstanceType<T>>[]) => {
		if(!specs.length) {
			return [];
		}
		return Promise.all(specs.map(s => this.update(s)));
	};

	// ============================================================
	// ====================== private stuff =======================
	// ============================================================
	/**
	 * Build the filter expression for attributes. Include all attributes which are not used in key expressions or
	 * a condition was supplied by user.
	 */
	private readonly getAttributeFilter = (spec: NativeSpec, builder: ConditionBuilder, templates: Set<string>) =>
		this.metadata.getAttributes()
			.filter(attr => spec[attr] != null)
			.filter(attr => !templates || typeof spec[attr] === 'function')
			.forEach(attr => {
				const valFn = spec[attr];
				builder.nextIndex();
				builder.addExpressionName(this.metadata.getAttribute(attr).get().name ?? attr);
				this.conditionOrDefault(valFn, builder, equal);
			});

	/**
	 * Build the conditions for scan operation on parts of keys.
	 */
	private readonly buildScanKeyFilter = (keyDef: KeyDef, spec: NativeSpec, builder: ConditionBuilder) => {
		const keyName = keyDef.name;

		// get the template borders
		const borders = [...keyDef.expression!.matchAll(/\{{2}|\}{2}/g)];

		// check if static text only
		if(!borders.length) {
			builder.nextIndex();
			builder.addExpressionName(keyName);
			equal(keyDef.expression!)(builder);
			return;
		}

		// check first if expression starts with template
		let templateStart = 0;
		if(borders[0].index === 0) {
			const valFn = spec[keyDef.expression!.substring(2, borders[1].index)];
			if(valFn) {
				builder.nextIndex();
				builder.addExpressionName(keyName);
				this.conditionOrDefault(valFn, builder, beginsWith);

				// check if template only
				if(borders.length === 2 && borders[1].index === keyDef.expression!.length - 1) {
					return;
				}
				templateStart = 2;
			}
		}

		// iterate rest of template borders
		for(let posi = templateStart; posi < borders.length; posi += 2) {
			const curr = borders[posi];

			// get static and template part
			const staticPart = keyDef.expression!.substring(posi ? borders[posi - 1].index! + 2 : 0, curr.index);
			const attrName = keyDef.expression!.substring(curr.index! + 2, borders[posi + 1].index);
			const valFn = spec[attrName];

			if(valFn && typeof valFn !== 'function') {
				// concatenate static part and value
				builder.nextIndex();
				builder.addExpressionName(keyName);
				this.containsOrBegins(posi, `${staticPart}${valFn}`, builder);
			} else if (staticPart.length) {
				// if no config was provided; just add the static part
				builder.nextIndex();
				builder.addExpressionName(keyName);
				this.containsOrBegins(posi, staticPart, builder);
			}
		}

		// add static text at the end
		const lastStart = borders[borders.length - 1].index! + 2;
		if(lastStart < keyDef.expression!.length) {
			builder.nextIndex();
			builder.addExpressionName(keyName);
			contains(keyDef.expression!.substring(lastStart))(builder);
		}
	};

	// little helper
	private conditionOrDefault = (valFn: Value | ConditionBuilderFunc, builder: ConditionBuilder, altFn: ConditionFunc) =>
		(typeof valFn === 'function' ? valFn : altFn(valFn))(builder);

	// little helper
	private containsOrBegins = (posi: number, value: Value, builder: ConditionBuilder) =>
		(posi ? contains : beginsWith)(value)(builder);

	/**
	 * Scan recursive
	 *
	 * @param input the scan input
	 * @returns the scanned items
	 */
	private readonly scanRecursive = async (input: ScanCommandInput, pk: KeyDef, sk?: Optional<KeyDef>) => {
		const { Items, LastEvaluatedKey } = await this.client.send(new ScanCommand(input));

		const scanned = Optional.of(Items)
			.map(items => items.map(it => this.mapper.deserialize(it, pk, sk)))
			.orElse([]);

		if(LastEvaluatedKey) {
			input.ExclusiveStartKey = LastEvaluatedKey;
			scanned.push(...await this.scanRecursive(input, pk, sk));
		}

		return scanned;
	};

	/**
	 * Query recursive
	 *
	 * @param input the query input
	 * @returns the queried items
	 */
	private readonly queryRecursive = async (input: QueryCommandInput, pk: KeyDef, sk?: Optional<KeyDef>) => {
		const { Items, LastEvaluatedKey } = await this.client.send(new QueryCommand(input));

		const queried = Optional.of(Items)
			.map(items => items.map(it => this.mapper.deserialize(it, pk, sk)))
			.orElse([]);

		if(LastEvaluatedKey) {
			input.ExclusiveStartKey = LastEvaluatedKey;
			queried.push(...await this.queryRecursive(input, pk, sk));
		}

		return queried;
	};

	/**
	 * Partially substitute the sort key..
	 *
	 * @param spec the query specification
	 * @returns the partial substituted sort key
	 */
	private readonly substituteSk = (spec: any, keyDef: KeyDef): Optional<string | number> => {
		// get the sortKey expression & templates
		const sortKey = keyDef.expression!;
		const templates = [...sortKey.matchAll(TEMPLATES)];

		// if no templates exist; just return expression
		if(!templates.length) {
			return Optional.of<string | number>(sortKey);
		}
		let substituted = '';

		// iterate templates; filter those without value
		for(let idx = 0; idx < templates.length; idx++) {
			const match = templates[idx];

			// check if previous exists
			let start = 0;
			if(idx > 0) {
				const prev = templates[idx - 1];
				start = prev.index! + prev[0].length;
			}

			// if no value or condition was supplied; abort
			if(!spec[match[1]] || typeof spec[match[1]] === 'function') {
				// if first template and does not start at the beginning
				// just use static part
				if(idx < 1 && match.index! > 0) {
					substituted = sortKey.substring(start, match.index);
				}
				break;
			}

			// append static part and value
			substituted += `${sortKey.substring(start, match.index)}${spec[match[1]]}`;
		}

		return Optional.of(substituted)
			.filter(val => val.length > 0)
			.map(val => new (keyDef.type)(val).valueOf());
	};

	/**
	 * Set the expression attribute name for attribute and index.
	 *
	 * @param name of the DynamoDB attribute
	 * @param idx running attribute index
	 * @param input the query command input
	 */
	private readonly addExpressionName = (name: string, idx: number, input: QueryCommandInput | ScanCommandInput | UpdateCommandInput) =>
		input.ExpressionAttributeNames![`#a${idx}`] = name;

	/**
	 * Build the key object for DynamoDB GetCommand
	 */
	private readonly buildGetKey = (key: Partial<InstanceType<T>>) => {
		// serialize object
		const obj = this.mapper.serialize(key);

		// remove all non-key attributes
		Object.keys(obj).filter(attr => !this.keyAttributes.has(attr))
			.forEach(attr => delete obj[attr]);

		return obj;
	};

	/**
	 * Resolve the DynamoDB keys recursively.
	 *
	 * @param Keys the dynamodb key to resolve
	 * @returns list of resolved items
	 */
	private readonly resolveKeys = async (Keys: Record<string, any>[]): Promise<Record<string, any>[]> => {
		// just abort
		if(!Keys.length) {
			return [];
		}

		const { Responses , UnprocessedKeys } = await this.client.send(new BatchGetCommand({
			RequestItems: {
				[this.metadata.getTable()]: { Keys }
			}
		}));

		// collect items
		const items = Optional.of(Responses)
			.map(resp => resp[this.metadata.getTable()])
			.orElse([]);

		// resolve unprocessed
		items.push(...await this.resolveKeys(Optional.of(UnprocessedKeys)
			.map(unp => unp[this.metadata.getTable()])
			.map(unp => unp.Keys)
			.orElse([])));

		return items;
	};

	/**
	 * Batch write the given DnynamoDB items.
	 *
	 * @param items the DynamoDB items to put
	 */
	private readonly batchItems = async (items: Record<string, any>[],
		reqCreate: (item: unknown) => BatchWriteRequest,
		resultMapper: (result: BatchWriteRequest) => any): Promise<void> => {
		if(!items.length) {
			return;
		}

		// send request
		const { UnprocessedItems } = await this.client.send(new BatchWriteCommand({
			RequestItems: {
				[this.metadata.getTable()]: items.map(item => reqCreate(item))
			}
		}));

		// process unprocessed
		return Optional.of(UnprocessedItems)
			.map(unp => unp[this.metadata.getTable()])
			.map(unp => unp.map(u => resultMapper(u)))
			.map(unp => this.batchItems(unp, reqCreate, resultMapper))
			.orElseGet(() => Promise.resolve());
	};

	/**
	 * Create a new class instance with assigned values from given item. Or item if already an instance.
	 *
	 * @param item the partial item
	 * @returns the created class instance
	 */
	private readonly toClassInstance = (item: Partial<T>) => (Object.getPrototypeOf(item) === Object.prototype
		? Object.assign(new this.type(), item)
		: item) as InstanceType<T>;
}

/**
 * Apply the given hooks on the items
 *
 * @param hooks the hooks to apply
 * @param items the instantiated items
 */
const applyHooks = (hooks: string[], ...items: any[]) => {
	hooks.map(hook => items.map(it => Optional.of(it[hook])))
		.flat()
		.forEach(hook => hook.ifPresent(fn => fn()));
};
