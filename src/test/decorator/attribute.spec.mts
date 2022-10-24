import test from 'ava';
import { Attribute } from '../../esm/decorator/attribute.mjs';
import { Item } from '../../esm/decorator/item.mjs';
import { MetadataService } from '../../esm/internal/core/metadata.service.mjs';

const service = MetadataService.getInstance();

test('withoutConfig', ctx => {
	class Test {
		@Attribute()
		readonly id!: number;
	}

	ctx.deepEqual(service.getMetadata(Test.prototype).getAttribute('id').get(), {
		name: undefined, type: undefined
	});
});

test('withName', ctx => {
	class Test {
		@Attribute({ name: 'pk', type: Number })
		readonly id!: number;
	}

	ctx.deepEqual(service.getMetadata(Test.prototype).getAttribute('id').get(), {
		name: 'pk', type: Number
	});
});

test('asPartitionKey', ctx => {
	class Test {
		@Attribute({ partitionKey: true, type: Number })
		readonly id!: number;
	}

	const metadata = service.getMetadata(Test.prototype);
	ctx.deepEqual(metadata.getAttribute('id').get(), {
		name: undefined, type: Number
	});
	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'id', type: Number, expression: '{{id}}', templateAttributes: new Set(['id'])
	});
});

test('asPartitionKeyWithName', ctx => {
	class Test {
		@Attribute({ name: 'partitionKey', partitionKey: true, type: Number })
		readonly id!: number;
	}

	const metadata = service.getMetadata(Test.prototype);
	ctx.deepEqual(metadata.getAttribute('id').get(), {
		name: 'partitionKey', type: Number
	});
	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'partitionKey', type: Number, expression: '{{id}}', templateAttributes: new Set(['id'])
	});
});

test('asSortKey', ctx => {
	class Test {
		@Attribute({ sortKey: true, type: Number })
		readonly id!: number;
	}

	const metadata = service.getMetadata(Test.prototype);
	ctx.deepEqual(metadata.getAttribute('id').get(), {
		name: undefined, type: Number
	});
	ctx.deepEqual(metadata.getSortKey().get(), {
		name: 'id', type: Number, expression: '{{id}}', templateAttributes: new Set(['id'])
	});
});

test('asSortKeyWithName', ctx => {
	class Test {
		@Attribute({ name: 'sortKey', sortKey: true, type: Number })
		readonly id!: number;
	}

	const metadata = service.getMetadata(Test.prototype);
	ctx.deepEqual(metadata.getAttribute('id').get(), {
		name: 'sortKey', type: Number
	});
	ctx.deepEqual(metadata.getSortKey().get(), {
		name: 'sortKey', type: Number, expression: '{{id}}', templateAttributes: new Set(['id'])
	});
});

test('overrideByItem', ctx => {
	@Item({
		table: {
			name: 'test',
			partitionKey: 'pk'
		},
		key: {
			partitionKey: '{{id}}'
		}
	})
	class Test {
		@Attribute({ partitionKey: true, type: String })
		readonly name!: string;

		@Attribute({ sortKey: true, type: Number })
		readonly revision!: number;

		readonly id!: number;
	}

	const metadata = service.getMetadata(Test.prototype);
	ctx.true(metadata.getSortKey().isNotPresent());
	ctx.deepEqual(metadata.getPartitionKey(), {
		name: 'pk', type: String, expression: '{{id}}', templateAttributes: new Set(['id'])
	});
});

test('inheritance', ctx => {
	@Item({
		table: 'objects',
		key: { partitionKey: 'OBJ#{{id}}', sortKey: 'SELF' }
	})
	class Base {
		@Attribute({ type: Number })
		readonly id!: number;
	}

	// test first
	class Concret1 extends Base {
		@Attribute({ type: String })
		readonly _1!: string;
	}

	const metadata1 = service.getMetadata(Concret1.prototype);
	ctx.is(metadata1.getTable(), 'objects');
	ctx.deepEqual(metadata1.getPartitionKey(), {
		name: 'pk', type: String, expression: 'OBJ#{{id}}', templateAttributes: new Set(['id'])
	});
	ctx.deepEqual(metadata1.getSortKey().get(), {
		name: 'sk', type: String, expression: 'SELF', templateAttributes: new Set([])
	});
	ctx.deepEqual(metadata1.getAttribute('id').get(), {
		name: undefined, type: Number
	});
	ctx.deepEqual(metadata1.getAttribute('_1').get(), {
		name: undefined, type: String
	});
	ctx.true(metadata1.getAttribute('_2').isNotPresent());

	// test second
	class Concret2 extends Base {
		@Attribute({ type: Number })
		readonly _2!: number;
	}

	const metadata2 = service.getMetadata(Concret2.prototype);
	ctx.is(metadata2.getTable(), 'objects');
	ctx.deepEqual(metadata2.getPartitionKey(), {
		name: 'pk', type: String, expression: 'OBJ#{{id}}', templateAttributes: new Set(['id'])
	});
	ctx.deepEqual(metadata2.getSortKey().get(), {
		name: 'sk', type: String, expression: 'SELF', templateAttributes: new Set([])
	});
	ctx.deepEqual(metadata2.getAttribute('id').get(), {
		name: undefined, type: Number
	});
	ctx.deepEqual(metadata2.getAttribute('_2').get(), {
		name: undefined, type: Number
	});
	ctx.true(metadata2.getAttribute('_1').isNotPresent());
});
