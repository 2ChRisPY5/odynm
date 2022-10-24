/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConditionBuilder } from './condition.builder.mjs';

// @internal
export type Constructable = { new (value?: any): object }

// @internal
export type Value = string | number | boolean | null;
// @internal
export type Comparator = '=' | '<>' | '<' | '<=' | '>' | '>=';
// @internal
export type ConditionBuilderFunc = (builder: ConditionBuilder) => void;
// @internal
export type ConditionFunc = (value: Value) => ConditionBuilderFunc;

// construct a type of all properties which can also have a condition builder function
// @internal
export type Specification<T> = {
	[K in keyof T]?: T[K] | ConditionBuilderFunc;
}
