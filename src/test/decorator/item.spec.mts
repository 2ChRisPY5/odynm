/* eslint-disable @typescript-eslint/no-unused-vars */
import test from 'ava';
import { Attribute } from '../../esm/decorator/attribute.mjs';
import { Item, ItemConfig } from '../../esm/decorator/item.mjs';
import { MetadataService } from '../../esm/internal/core/metadata.service.mjs';

const service = MetadataService.getInstance();

test('noPartitionKey', ctx => {
	ctx.throws(() => testClass({}));
});

test('noAttributes', ctx => {
	ctx.throws(() => {
		@Item({
			table: 'test',
			key: { partitionKey: '{{}}' }
		})
		class NoAttributes {}
	});
});

test('keyExpression', ctx => {
	const metadata = service.getMetadata(testClass({
		key: {
			partitionKey: '{{id}}',
			sortKey: '{{id2}}'
		}
	}).prototype);

	ctx.is(metadata.getPartitionKey().expression, '{{id}}');
	ctx.is(metadata.getSortKey().get().expression, '{{id2}}');
});

test('tableOverrideWithoutTypes', ctx => {
	const metadata = service.getMetadata(testClass({
		table: {
			name: 'test',
			partitionKey: 'partitionKey',
			sortKey: 'sortKey'
		},
		key: { partitionKey: '{{}}', sortKey: '{{}}' }
	}).prototype);

	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'partitionKey', type: String, expression: '{{}}', templateAttributes: new Set([])
	});
	ctx.deepEqual(metadata.getSortKey().get(), {
		name: 'sortKey', type: String, expression: '{{}}', templateAttributes: new Set([])
	});
});

test('tableOverrideRemoveSortKey', ctx => {
	const metadata = service.getMetadata(testClass({
		table: {
			name: 'test',
			partitionKey: 'pk'
		},
		key: { partitionKey: '{{}}'}
	}).prototype);

	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'pk', type: String, expression: '{{}}', templateAttributes: new Set([])
	});
	ctx.true(metadata.getSortKey().isNotPresent());
});

test('tableOverrideWithTypes', ctx => {
	const metadata = service.getMetadata(testClass({
		table: {
			name: 'test',
			partitionKey: { name: 'pk', type: Number },
		},
		key: { partitionKey: '{{}}' }
	}).prototype);

	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'pk', type: Number, expression: '{{}}', templateAttributes: new Set([])
	});
	ctx.true(metadata.getSortKey().isNotPresent());
});

/**
 * Create a default test class for testing.
 *
 * @param config the partial configuration to apply
 * @returns the created type mixing
 */
const testClass = (config: Partial<ItemConfig>) => {
	@Item(Object.assign({ table: 'test' }, config))
	class TestType {
		@Attribute()
		readonly name!: string;
	}

	return TestType;
};
