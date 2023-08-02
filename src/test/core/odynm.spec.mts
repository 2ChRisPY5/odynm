import test from 'ava';
import { ODynM } from '../../esm/index.mjs';

test('initialize', ctx => {
	ctx.notThrows(ODynM.initialize);
});
