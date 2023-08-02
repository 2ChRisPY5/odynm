/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'ava';
import { Type } from '../../esm/decorator/type.mjs';
import { Attribute, Item } from '../../esm/index.mjs';
import { ItemMapper } from '../../esm/internal/core/item-mapper.mjs';

// declarations
@Item({
	table: {
		name: 'project',
		partitionKey: 'pk',
		sortKey: 'sk',
		lsi: {
			LSI1: 'sk2'
		},
		gsi: {
			GSI1: {
				partitionKey: { name: 'pk3', type: Number },
				sortKey: 'sk3'
			}
		}
	},
	key: {
		partitionKey: '{{name}}',
		sortKey: 'REV#{{revision}}'
	},
	lsi: {
		LSI1: 'VERSION#{{version}}'
	},
	gsi: {
		GSI1: {
			partitionKey: '{{revision}}',
			sortKey: '{{name}}'
		}
	}
})
class Project {
	name!: string;

	@Type(Number)
	public revision!: number;

	@Attribute()
	public version!: string;

	@Attribute({ name: 'people', type: Set })
	public users!: Set<string>;
}

const users = new Set(['you', 'me']);
const MAPPER = new ItemMapper(Project);

// tests
test('serializeClass', ctx => {
	const instance: Project = {
		name: 'TEST_A',
		revision: 1,
		version: 'Initial',
		users
	};

	ctx.deepEqual(MAPPER.serialize(instance), {
		pk: 'TEST_A',
		sk: 'REV#1',
		version: 'Initial',
		people: users
	});
});

test('serializeObjectLiteral', ctx => {
	ctx.deepEqual((MAPPER as ItemMapper<any>).serialize({
		name: 'TEST_B',
		revision: 2,
		version: 'Root',
		users: ['you', 'me']
	}), {
		pk: 'TEST_B',
		sk: 'REV#2',
		version: 'Root',
		people: users
	});
});

test('deserialize', ctx => {
	const expected = new Project();
	expected.name = 'TEST_C';
	expected.revision = 1846;
	expected.version = 'Something cool';
	expected.users = users;

	ctx.deepEqual(MAPPER.deserialize({
		pk: 'TEST_C',
		sk: 'REV#1846',
		version: 'Something cool',
		people: users
	}), expected);
});

test('deserialize - LSI', ctx => {
	const expected = new Project();
	expected.name = 'TEST_C';
	expected.version = 'Something cool';
	expected.users = users;

	ctx.deepEqual(MAPPER.deserialize({
		pk: 'TEST_C',
		sk2: 'VERSION#Something cool',
		revision: 1846,
		people: users
	}), expected);
});

test('deserialize - GSI', ctx => {
	const expected = new Project();
	expected.name = 'TEST_C';
	expected.revision = 1846;
	expected.version = 'Something cool';
	expected.users = users;

	ctx.deepEqual(MAPPER.deserialize({
		pk3: 1846,
		sk3: 'TEST_C',
		version: 'Something cool',
		people: users
	}), expected);
});
