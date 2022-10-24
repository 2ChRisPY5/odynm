import test from 'ava';
import { Type } from '../../esm/decorator/type.mjs';
import { MetadataService } from '../../esm/internal/core/metadata.service.mjs';

const service = MetadataService.getInstance();

test('setType', ctx => {
	class Test {
		@Type(Number)
		readonly id!: number;
	}

	ctx.is(service.getMetadata(Test.prototype).getType('id').get(), Number);
});
