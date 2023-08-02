/* eslint-disable @typescript-eslint/no-explicit-any */
import { UpdateBuilderFn } from '../internal/types.mjs';

/**
 * Increment the attribute by the given value.
 *
 * @param value the number to increment by
 */
export const increment = (value: number): UpdateBuilderFn => builder => {
	builder.addValue(value);
	builder.addSet(`${builder.attributeExpression} = ${builder.attributeExpression} + ${builder.valueExpression}`);
};

/**
 * Decrement the attribute by the given value.
 *
 * @param value the number to decrement by
 */
export const decrement = (value: number): UpdateBuilderFn => builder => {
	builder.addValue(value);
	builder.addSet(`${builder.attributeExpression} = ${builder.attributeExpression} - ${builder.valueExpression}`);
};

/**
 * Append given values to the list. Abort if no values are supplied.
 *
 * @param values array of values
 */
export const appendList = (...values: any[]): UpdateBuilderFn => builder => {
	if(!values.length) {
		return;
	}
	builder.addValue(values);
	builder.addSet(`${builder.attributeExpression} = list_append(${builder.attributeExpression}, ${builder.valueExpression})`);
};

/**
 * Mark the attribute to be removed from item.
 */
export const remove: UpdateBuilderFn = builder => builder.addRemove();

/**
 * Add given values to the set. Abort if no values are supplied. This function cannot be used for numeric values.
 * Use increment/decrement instead.
 *
 * @param values array of values
 */
export const addSet = (...values: string[] | number[]): UpdateBuilderFn => builder => {
	if(!values.length) {
		return;
	}
	builder.addValue(new Set<string | number>(values));
	builder.addAdd();
};

/**
 * Remove given values from the set. Abort if no values are supplied.
 *
 * @param values array of values
 */
export const deleteSet = (...values: string[] | number[]): UpdateBuilderFn => builder => {
	if(!values.length) {
		return;
	}
	builder.addValue(new Set<string | number>(values));
	builder.addDelete();
};
