/* eslint-disable @typescript-eslint/no-unused-vars */
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import test from 'ava';
import { attributeExists, attributeNotExists, greaterThanOrEqual, attributeType, isIn, between,
	isNull, nullOrUndefined, not, equal, lessThan } from '../../esm/core/conditions.mjs';
import { Attribute, decrement, increment, Item, ODynM, PostLoad, PrePut, PreUpdate, remove } from '../../esm/index.mjs';

// test declarations
const table = 'projects';
@Item({
	table,
	key: {
		partitionKey: '{{name}}',
		sortKey: 'VER:{{version}}#REV:{{revision}}'
	}
})
class Project {
	@Attribute()
	readonly name!: string;
	@Attribute()
	readonly version!: string;
	@Attribute({ type: Number })
	readonly revision!: number;
	@Attribute({ type: Number })
	public date?: number | null;

	constructor(project: Project) {
		Object.assign(this, project);
	}
}

const CLIENT = DynamoDBDocumentClient.from(new DynamoDBClient({
	endpoint: 'http://localhost:8000',
	credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' }
}));
const ODYNM = ODynM.initialize(CLIENT);
const REPO = ODYNM.getRepository(Project);

// create table with test data
test.beforeEach('recreate DynamoDB table', async _ => {
	await CLIENT.send(new CreateTableCommand({
		TableName: table,
		KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
		AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }, { AttributeName: 'sk', AttributeType: 'S' }],
		BillingMode: 'PAY_PER_REQUEST'
	}));

	await Promise.all([
		REPO.put({ name: 'PROJECT_A', version: 'Initial', revision: 515, date: 1662541189 }),
		REPO.putAll({ name: 'PROJECT_A', version: 'Initial', revision: 1 },
			{ name: 'PROJECT_B', version: 'Something', revision: 2 })
	]);
});
// drop table afterwards
test.afterEach('drop DynamoDB table', async _ => {
	await CLIENT.send(new DeleteTableCommand({ TableName: table }));
});

// test section
test.serial('noItemType', ctx => {
	ctx.throws(() => ODYNM.getRepository(Number));
});

test.serial('getEmpty', async ctx => {
	const result = await REPO.get({ name: 'test', version: 'a', revision: 1 });
	ctx.true(result.isNotPresent());
});

test.serial('get', async ctx => {
	const result = await REPO.get({ name: 'PROJECT_A', version: 'Initial', revision: 1 });
	ctx.true(result.isPresent());
});

test.serial('getMany', async ctx => {
	const result = await REPO.getMany({ name: 'PROJECT_A', version: 'Initial', revision: 1 },
		{ name: 'PROJECT_A', version: 'Initial', revision: 515 },
		{ name: 'bla', version: 'bla', revision: 0 });

	ctx.deepEqual(result, [
		new Project({ name: 'PROJECT_A', version: 'Initial', revision: 515, date: 1662541189 }),
		new Project({ name: 'PROJECT_A', version: 'Initial', revision: 1 })
	]);
});

test.serial('query - onlyPartitionKey', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A' });
	ctx.is(items.length, 2);
});

test.serial('query - withPlainValue', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: 1662541189 });
	ctx.is(items.length, 1);
});

test.serial('query - withSortKey', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', version: 'Init' });
	ctx.is(items.length, 2);
});

test.serial('query - customSortKeyFunc', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', version: 'Initial' }, { sortKeyComparator: greaterThanOrEqual });
	ctx.is(items.length, 2);
});

test.serial('query - attributeExists', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: attributeExists() });
	ctx.is(items.length, 1);
});

test.serial('query - attributeNotExists', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: attributeNotExists() });
	ctx.is(items.length, 1);
});

test.serial('query - attributeType', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: attributeType('N') });
	ctx.is(items.length, 1);
});

test.serial('query - in', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: isIn(0, 2, 3) });
	ctx.is(items.length, 0);
});

test.serial('query - between', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: between(1662541000, 1662541200) });
	ctx.is(items.length, 1);
});

test.serial('query - isNull', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: isNull() });
	ctx.is(items.length, 0);
});

test.serial('query - isNullOrUndefined', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: nullOrUndefined() });
	ctx.is(items.length, 1);
});

test.serial('query - not', async ctx => {
	const items = await REPO.query({ name: 'PROJECT_A', date: not(nullOrUndefined()) });
	ctx.is(items.length, 1);
});

test.serial('scan - all', async ctx => {
	const items = await REPO.scan();
	ctx.is(items.length, 3);
});

test.serial('scan - withKeys', async ctx => {
	const items = await REPO.scan({
		name: 'PROJECT',
		version: equal('Something'),
		revision: lessThan(3),
		date: nullOrUndefined()
	});
	ctx.is(items.length, 1);
});

test.serial('delete', async ctx => {
	await REPO.delete({ name: 'PROJECT_B', version: 'Something', revision: 2 });
	ctx.pass();
});

test.serial('deleteAll', async ctx => {
	await REPO.deleteAll({ name: 'PROJECT_B', version: 'Something', revision: 2 },
		{ name: 'PROJECT_A', version: 'Initial', revision: 1 },
		{ name: 'PROJECT_A', version: 'Initial', revision: 515 });
	ctx.pass();
});

test.serial('update - withoutFunctions', async ctx => {
	const project = new Project({ name: 'PROJECT_B', version: 'Something', revision: 2, date: 1911 });
	ctx.deepEqual(await REPO.update(project), project);
});

test.serial('update - increment/decrement', async ctx => {
	const project = new Project({ name: 'PROJECT_A', version: 'Initial', revision: 515 });
	const updated = await REPO.update({ ...project, date: increment(10) });
	ctx.is(updated.date, 1662541199);

	const updated2 = await REPO.update({ ...project, date: decrement(20) });
	ctx.is(updated2.date, 1662541179);
});

test.serial('update - remove', async ctx => {
	const updated = await REPO.update({ name: 'PROJECT_A', version: 'Initial', revision: 515, date: remove });
	ctx.is(updated.date, undefined);
});

test.serial('hooks', async ctx => {
	let prePutRun = false;
	let preUpdateRun = false;
	let postLoadRun = false;

	class HookedProject extends Project {
		@PrePut
		private readonly prePut = () => {
				prePutRun = true;
			};

		@PreUpdate
		private readonly preUpdate = () => {
				preUpdateRun = true;
			};

		@PostLoad
		private readonly postLoad = () => {
				postLoadRun = true;
			};
	}

	const project = new HookedProject({ name: 'HOOK', revision: 1, version: '1' });
	const repo = ODYNM.getRepository(HookedProject);

	await repo.put(project);
	await repo.update(project);
	await repo.get(project);

	ctx.true(prePutRun);
	ctx.true(preUpdateRun);
	ctx.true(postLoadRun);
});
