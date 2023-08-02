/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Value } from '@aws-sdk/smithy-client';
import { ConditionBuilder } from '../internal/condition.builder.mjs';
import { Comparator, ConditionBuilderFunc, ConditionFunc } from './types.mjs';

export type DynamoDBType = 'S' | 'SS' | 'M' | 'L' | 'N' | 'NS' | 'BOOL' | 'B' | 'BS' | 'NULL';

/**
 * Wrap given conditions into braces with AND.
 *
 * @param conditions the list of conditions
 */
export const and = (...conditions: ConditionBuilderFunc[]): ConditionBuilderFunc => builder =>
	andOr(builder, 'AND', conditions.map(cond => {
		cond(builder);
		return builder.removeLastCondition();
	}));

/**
 * Wrap given conditions into braces with OR.
 *
 * @param conditions the list of conditions
 */
export const or = (...conditions: ConditionBuilderFunc[]): ConditionBuilderFunc => builder =>
	andOr(builder, 'OR', conditions.map(cond => {
		cond(builder);
		return builder.removeLastCondition();
	}));

/**
 * Negates the given condition.
 *
 * @param condition the nested condition
 */
export const not = (condition: ConditionBuilderFunc): ConditionBuilderFunc => builder => {
	condition(builder);
	builder.addConditions(`NOT ${builder.removeLastCondition()}`);
};

/**
 * Check if the attribute is either not defined or explicit null.
 */
export const nullOrUndefined = (): ConditionBuilderFunc => builder => {
	let newCondition = '(';

	// add first condition
	attributeNotExists()(builder);
	newCondition += `${builder.removeLastCondition()} OR `;

	// add second one
	equal(null)(builder);
	newCondition += `${builder.removeLastCondition()})`;

	builder.addConditions(newCondition);
};

/**
 * Check if attribute is explicit set to null.
 */
export const isNull = (): ConditionBuilderFunc => equal(null);

/**
 * Performs a '=' check with given value.
 *
 * @param value the value to check against
 */
export const equal: ConditionFunc = value => builder => basicCompare(builder, value, '=');

/**
 * Performs a '<>' check with given value.
 *
 * @param value the value to check against
 */
export const notEqual: ConditionFunc = value => builder => basicCompare(builder, value, '<>');

/**
 * Performs a '<' check with given value.
 *
 * @param value the value to check against
 */
export const lessThan: ConditionFunc = value => builder => basicCompare(builder, value, '<');

/**
 * Performs a '<=' check with given value.
 *
 * @param value the value to check against
 */
export const lessThanOrEqual: ConditionFunc = value => builder => basicCompare(builder, value, '<=');

/**
 * Performs a '>' check with given value.
 *
 * @param value the value to check against
 */
export const greaterThan: ConditionFunc = value => builder => basicCompare(builder, value, '>');

/**
 * Performs a '>=' check with given value.
 *
 * @param value the value to check against
 */
export const greaterThanOrEqual: ConditionFunc = value => builder => basicCompare(builder, value, '>=');

/**
 * Performs a 'BETWEEN' check with given from and to values.
 *
 * @param from the inclusive starting value
 * @param to the inclusive end value
 */
export const between = (from: Value, to: Value): ConditionBuilderFunc => builder => {
	// save for later
	const start = builder.index;

	builder.addExpressionValue(from);
	builder.nextIndex();
	builder.addExpressionValue(to);

	builder.addConditions(`#a${start} BETWEEN :v${start} AND ${builder.valueExp}`);
};

/**
 * Performs an 'IN' check with given values. If no values are provided nothing will be evaluated.
 *
 * @param values list of values
 */
export const isIn = (...values: Value[]): ConditionBuilderFunc => builder => {
	// do nothing if empty
	if(!values.length) {
		return;
	}

	// save for later because index gets increased
	const attributeExp = builder.attributeExp;

	// build operands
	const operands = values.map(val => {
		builder.nextIndex();
		builder.addExpressionValue(val);
		return builder.valueExp;
	}).join(', ');

	builder.addConditions(`${attributeExp} IN (${operands})`);
};

/**
 * Checks if the attribute exists on an item.
 */
export const attributeExists = (): ConditionBuilderFunc => builder =>
	builder.addConditions(`attribute_exists(${builder.attributeExp})`);

/**
 * Checks if the attribute does not exist on an item.
 */
export const attributeNotExists = (): ConditionBuilderFunc => builder =>
	builder.addConditions(`attribute_not_exists(${builder.attributeExp})`);

/**
 * Check if the DynamoDB type equals the given type.
 * @param type the DynamoDB type
 */
export const attributeType = (type: DynamoDBType): ConditionBuilderFunc => builder => {
	builder.addExpressionValue(type);
	builder.addConditions(`attribute_type(${builder.attributeExp}, ${builder.valueExp})`);
};

/**
 * Check if the attribute starts with the given string.
 *
 * @param value the value to check against
 */
export const beginsWith: ConditionFunc = value => builder => {
	builder.addExpressionValue(value);
	builder.addConditions(`begins_with(${builder.attributeExp}, ${builder.valueExp})`);
};

/**
 * Check if a string or set (BS, NS, SS) contains the given value.
 *
 * @param value the value to check
 */
export const contains: ConditionFunc = value => builder => {
	builder.addExpressionValue(value);
	builder.addConditions(`contains(${builder.attributeExp}, ${builder.valueExp})`);
};

/**
 * Check if the size if the attribute matches the given comparator and operand.
 *
 * @param comparator the comparator to use
 * @param value the operand to evaluate against
 */
export const size = (comparator: Comparator, value: number): ConditionBuilderFunc => builder => {
	builder.addExpressionValue(value);
	builder.addConditions(`size(${builder.attributeExp}) ${comparator} ${builder.valueExp}`);
};

// just a small helper
const basicCompare = (builder: ConditionBuilder, value: Value, operator: string): void => {
	builder.addExpressionValue(value);
	builder.addConditions(`${builder.attributeExp} ${operator} ${builder.valueExp}`);
};

const andOr = (builder: ConditionBuilder, andOr: 'AND' | 'OR', conditions: string[]) => {
	// do nothing
	if(!conditions.length) {
		return;
	}

	const all = conditions.join(` ${andOr} `);
	builder.addConditions(`(${all})`);
};
